"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { toInt, toFloat, toDate, calcTax, yen } from "./utils";
import { calcMonthlySettlement } from "./settlement";
import { COMPANY_SINGLETON_ID } from "./company";
import {
  createSession,
  destroySession,
  verifyPassword,
  getCurrentUser,
  getCurrentEngineerId,
} from "./auth";

/* ========== 認証 ========== */
export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { error: "アカウントが見つかりません。" };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "パスワードが正しくありません。" };

  await createSession(user.id);
  // エンジニア本人はマイページ、それ以外は管理ダッシュボードへ
  redirect(user.role === "ENGINEER" ? "/mypage" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

async function ensureAuth() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/* ========== 技術者 ========== */
export async function saveEngineer(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const data = {
    code: String(formData.get("code") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    nameKana: String(formData.get("nameKana") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    employmentType: String(formData.get("employmentType") || "EMPLOYEE"),
    affiliation: String(formData.get("affiliation") || "").trim() || null,
    status: String(formData.get("status") || "AVAILABLE"),
    costRate: toInt(formData.get("costRate")),
    sellRateMin: toInt(formData.get("sellRateMin")),
    experienceYears: toInt(formData.get("experienceYears")),
    joinedOn: toDate(formData.get("joinedOn")),
    note: String(formData.get("note") || "").trim() || null,
  };
  if (!data.code || !data.name) throw new Error("要員番号と氏名は必須です。");

  if (id) {
    await prisma.engineer.update({ where: { id }, data });
  } else {
    await prisma.engineer.create({ data });
  }
  revalidatePath("/engineers");
  redirect("/engineers");
}

export async function deleteEngineer(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.engineerSkill.deleteMany({ where: { engineerId: id } });
    await prisma.engineer.delete({ where: { id } });
  }
  revalidatePath("/engineers");
  redirect("/engineers");
}

/* ========== 取引先 ========== */
export async function saveClient(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").trim(),
    nameKana: String(formData.get("nameKana") || "").trim() || null,
    clientType: String(formData.get("clientType") || "END"),
    contactName: String(formData.get("contactName") || "").trim() || null,
    contactEmail: String(formData.get("contactEmail") || "").trim() || null,
    contactPhone: String(formData.get("contactPhone") || "").trim() || null,
    closingDay: toInt(formData.get("closingDay")) || 31,
    paymentTermDays: toInt(formData.get("paymentTermDays")) || 30,
    address: String(formData.get("address") || "").trim() || null,
    note: String(formData.get("note") || "").trim() || null,
  };
  if (!data.name) throw new Error("取引先名は必須です。");
  if (id) await prisma.client.update({ where: { id }, data });
  else await prisma.client.create({ data });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

/* ========== 案件 ========== */
export async function saveProject(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const data = {
    code: String(formData.get("code") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    clientId: String(formData.get("clientId") || ""),
    contractType: String(formData.get("contractType") || "QUASI_MANDATE"),
    workLocation: String(formData.get("workLocation") || "").trim() || null,
    startOn: toDate(formData.get("startOn")),
    endOn: toDate(formData.get("endOn")),
    requiredCount: toInt(formData.get("requiredCount")) || 1,
    unitPriceMin: toInt(formData.get("unitPriceMin")),
    unitPriceMax: toInt(formData.get("unitPriceMax")),
    requiredSkills: String(formData.get("requiredSkills") || "").trim() || null,
    status: String(formData.get("status") || "OPEN"),
    description: String(formData.get("description") || "").trim() || null,
  };
  if (!data.code || !data.title || !data.clientId)
    throw new Error("案件コード・案件名・取引先は必須です。");
  if (id) await prisma.project.update({ where: { id }, data });
  else await prisma.project.create({ data });
  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProject(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects");
}

/* ========== アサイン ========== */
export async function saveAssignment(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const data = {
    engineerId: String(formData.get("engineerId") || ""),
    projectId: String(formData.get("projectId") || ""),
    status: String(formData.get("status") || "PROPOSED"),
    sellRate: toInt(formData.get("sellRate")),
    costRate: toInt(formData.get("costRate")),
    startOn: toDate(formData.get("startOn")),
    endOn: toDate(formData.get("endOn")),
    standardHoursMin: toInt(formData.get("standardHoursMin")) || 140,
    standardHoursMax: toInt(formData.get("standardHoursMax")) || 180,
    note: String(formData.get("note") || "").trim() || null,
  };
  if (!data.engineerId || !data.projectId)
    throw new Error("技術者と案件の選択は必須です。");

  if (id) await prisma.assignment.update({ where: { id }, data });
  else await prisma.assignment.create({ data });

  // 稼働中アサインなら技術者ステータスを稼働中に同期
  if (data.status === "ACTIVE" || data.status === "ORDERED") {
    await prisma.engineer.update({
      where: { id: data.engineerId },
      data: { status: "ASSIGNED" },
    });
  }
  revalidatePath("/assignments");
  redirect("/assignments");
}

export async function deleteAssignment(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) {
    await prisma.contract.deleteMany({ where: { assignmentId: id } });
    await prisma.timesheet.deleteMany({ where: { assignmentId: id } });
    await prisma.assignment.delete({ where: { id } });
  }
  revalidatePath("/assignments");
  redirect("/assignments");
}

/* ========== 工数 ========== */
export async function saveTimesheet(formData: FormData) {
  await ensureAuth();
  const assignmentId = String(formData.get("assignmentId") || "");
  const yearMonth = String(formData.get("yearMonth") || "");
  const workedHours = toFloat(formData.get("workedHours"));
  const status = String(formData.get("status") || "DRAFT");
  const note = String(formData.get("note") || "").trim() || null;
  if (!assignmentId || !yearMonth) throw new Error("アサインと対象年月は必須です。");

  await prisma.timesheet.upsert({
    where: { assignmentId_yearMonth: { assignmentId, yearMonth } },
    update: { workedHours, status, note },
    create: { assignmentId, yearMonth, workedHours, status, note },
  });
  revalidatePath("/timesheets");
  redirect(`/timesheets?ym=${yearMonth}`);
}

/* ========== 勤務表アップロード取込（クラウド対応） ========== */
export async function importUploadedTimesheets(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES" && user.role !== "ACCOUNTING")) {
    return { error: "権限がありません。", rows: [], created: 0, updated: 0, previewOnly: true };
  }
  const previewOnly = formData.get("previewOnly") === "on";
  const fileEntries = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (fileEntries.length === 0) {
    return { error: "Excelファイルを選択してください。", rows: [], created: 0, updated: 0, previewOnly };
  }

  const { parseWorkbookBuffer } = await import("./timesheet-import");
  const { buildPlanFromParsed } = await import("./timesheet-import-plan");

  const parsed = [];
  for (const f of fileEntries) {
    const buf = Buffer.from(await f.arrayBuffer());
    parsed.push(parseWorkbookBuffer(f.name, buf));
  }
  const rows = await buildPlanFromParsed(parsed);

  let created = 0;
  let updated = 0;
  if (!previewOnly) {
    for (const row of rows) {
      if (
        (row.status === "ready_create" || row.status === "ready_update") &&
        row.assignmentId &&
        row.yearMonth &&
        row.totalHours != null
      ) {
        const existing = await prisma.timesheet.findUnique({
          where: { assignmentId_yearMonth: { assignmentId: row.assignmentId, yearMonth: row.yearMonth } },
        });
        const status = existing?.status === "APPROVED" ? "APPROVED" : "SUBMITTED";
        await prisma.timesheet.upsert({
          where: { assignmentId_yearMonth: { assignmentId: row.assignmentId, yearMonth: row.yearMonth } },
          update: { workedHours: row.totalHours, status, note: `勤務表取込: ${row.file.fileName}` },
          create: {
            assignmentId: row.assignmentId,
            yearMonth: row.yearMonth,
            workedHours: row.totalHours,
            status: "SUBMITTED",
            note: `勤務表取込: ${row.file.fileName}`,
          },
        });
        if (existing) updated++;
        else created++;
      }
    }
    revalidatePath("/timesheets");
    revalidatePath("/mypage");
  }
  return { error: null, rows, created, updated, previewOnly };
}

/* ========== 勤務表フォルダ取込（ローカルdev用） ========== */
export async function commitTimesheetImport(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SALES" && user.role !== "ACCOUNTING")) {
    redirect("/login");
  }
  const dir = String(formData.get("dir") || "").trim();
  const { buildImportPlan } = await import("./timesheet-import-plan");
  const plan = await buildImportPlan(dir || null);

  let created = 0;
  let updated = 0;
  for (const row of plan.rows) {
    if (
      (row.status === "ready_create" || row.status === "ready_update") &&
      row.assignmentId &&
      row.yearMonth &&
      row.totalHours != null
    ) {
      const existing = await prisma.timesheet.findUnique({
        where: { assignmentId_yearMonth: { assignmentId: row.assignmentId, yearMonth: row.yearMonth } },
      });
      const status = existing?.status === "APPROVED" ? "APPROVED" : "SUBMITTED";
      await prisma.timesheet.upsert({
        where: { assignmentId_yearMonth: { assignmentId: row.assignmentId, yearMonth: row.yearMonth } },
        update: { workedHours: row.totalHours, status, note: `勤務表取込: ${row.file.fileName}` },
        create: {
          assignmentId: row.assignmentId,
          yearMonth: row.yearMonth,
          workedHours: row.totalHours,
          status: "SUBMITTED",
          note: `勤務表取込: ${row.file.fileName}`,
        },
      });
      if (existing) updated++;
      else created++;
    }
  }
  revalidatePath("/timesheets");
  revalidatePath("/mypage");
  const dirQ = dir ? `&dir=${encodeURIComponent(dir)}` : "";
  redirect(`/timesheets/import?created=${created}&updated=${updated}${dirQ}`);
}

/* ========== 請求（自動生成） ========== */
export async function generateInvoices(formData: FormData) {
  await ensureAuth();
  const yearMonth = String(formData.get("yearMonth") || "");
  if (!yearMonth) throw new Error("対象年月を指定してください。");

  // 対象月に稼働中のアサインを取引先ごとに集約して請求を生成
  // 契約（精算条件・実単価）と当月工数を取り込み、控除/超過を独立明細として展開する
  const assignments = await prisma.assignment.findMany({
    where: { status: { in: ["ACTIVE", "ORDERED", "ENDED"] } },
    include: {
      engineer: true,
      project: { include: { client: true } },
      contract: true,
      timesheets: { where: { yearMonth } },
    },
  });

  // 1人ずつ（取引先 × エンジニア）でグルーピング。
  // 同一エンジニアが同一取引先で複数アサインを持つ場合のみ1通に集約する。
  const byPerson = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const key = `${a.project.clientId}__${a.engineerId}`;
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push(a);
  }

  // 対象月の期間表記（YYYY年MM月DD日）
  const [yy, mm] = yearMonth.split("-").map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const mmStr = String(mm).padStart(2, "0");
  const periodStart = `${yy}年${mmStr}月01日`;
  const periodEnd = `${yy}年${mmStr}月${String(lastDay).padStart(2, "0")}日`;
  const fmtH = (h: number) => String(h);

  type NewItem = {
    assignmentId: string;
    description: string;
    unitPrice: number;
    quantity: number;
    amount: number;
  };

  // 請求番号の重複回避（要員番号ベース）
  const usedNos = new Set<string>();
  const uniqueInvoiceNo = async (code: string): Promise<string> => {
    const base = `INV-${yearMonth.replace("-", "")}-${code || "000"}`;
    let cand = base;
    let n = 1;
    while (usedNos.has(cand) || (await prisma.invoice.findUnique({ where: { invoiceNo: cand } }))) {
      n += 1;
      cand = `${base}-${n}`;
    }
    usedNos.add(cand);
    return cand;
  };

  let created = 0;
  for (const list of byPerson.values()) {
    // 既存（同月・同一アサイン）があればスキップ
    const assignmentIds = list.map((a) => a.id);
    const exists = await prisma.invoice.findFirst({
      where: { yearMonth, items: { some: { assignmentId: { in: assignmentIds } } } },
    });
    if (exists) continue;

    const client = list[0].project.client;
    const items: NewItem[] = [];

    for (const a of list) {
      const contract = a.contract;
      const worked = a.timesheets[0]?.workedHours ?? null;
      // 実単価（客先請求）。契約があれば契約の実単価、無ければアサインの請求単価
      const baseRate = contract?.monthlyRate || a.sellRate;
      const descBase = `件名：${a.project.title}\n${a.engineer.name} ${periodStart}〜${periodEnd}`;

      // 契約が時給の場合：実働時間 × 時給
      if (contract && contract.rateType === "HOURLY" && worked != null) {
        const amt = Math.round(baseRate * worked);
        items.push({ assignmentId: a.id, description: descBase, unitPrice: baseRate, quantity: worked, amount: amt });
        continue;
      }

      // 基準額（月額）の明細
      items.push({ assignmentId: a.id, description: descBase, unitPrice: baseRate, quantity: 1, amount: baseRate });

      // 精算（控除/超過）を独立明細として展開（契約＋当月工数がある場合のみ）
      if (contract && worked != null) {
        const s = calcMonthlySettlement(
          {
            rateType: contract.rateType,
            settlementType: contract.settlementType,
            lowerHours: contract.lowerHours,
            upperHours: contract.upperHours,
            fixedHours: contract.fixedHours,
            dailyStdHours: contract.dailyStdHours,
            bufferHours: contract.bufferHours,
            settlementMethod: contract.settlementMethod,
            deductionRate: contract.deductionRate,
            excessRate: contract.excessRate,
          },
          { yearMonth, workedHours: worked, baseRate }
        );
        if (s.status === "deduct" && s.unitRate != null) {
          const desc = `【控除精算分】\n（${fmtH(worked)}h - ${fmtH(s.lower ?? 0)}h => ${-s.diffHours} × ${yen(s.unitRate)}）`;
          items.push({ assignmentId: a.id, description: desc, unitPrice: s.adjustment, quantity: 1, amount: s.adjustment });
        } else if (s.status === "excess" && s.unitRate != null) {
          const desc = `【超過精算分】\n（${fmtH(worked)}h - ${fmtH(s.upper ?? 0)}h => +${s.diffHours} × ${yen(s.unitRate)}）`;
          items.push({ assignmentId: a.id, description: desc, unitPrice: s.adjustment, quantity: 1, amount: s.adjustment });
        }
      }
    }

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    if (subtotal === 0) continue;
    const { tax, total } = calcTax(subtotal, 10);

    // 請求日＝締め日（その月）、支払期限日＝請求日＋支払サイト
    // 支払サイトは契約ごとの設定を優先し、無ければ取引先の既定を使用
    const termDays = list[0].contract?.paymentTermDays ?? client.paymentTermDays;
    const closeDay = client.closingDay >= 31 ? lastDay : Math.min(client.closingDay, lastDay);
    const issueDate = new Date(yy, mm - 1, closeDay);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + termDays);

    const invoiceNo = await uniqueInvoiceNo(list[0].engineer.code);
    await prisma.invoice.create({
      data: {
        invoiceNo,
        clientId: client.id,
        yearMonth,
        status: "DRAFT",
        issueDate,
        dueDate,
        subtotal,
        taxRate: 10,
        taxAmount: tax,
        total,
        items: { create: items },
      },
    });
    created++;
  }
  revalidatePath("/invoices");
  redirect(`/invoices?ym=${yearMonth}&generated=${created}`);
}

export async function updateInvoiceStatus(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "DRAFT");
  if (id) await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function deleteInvoice(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) await prisma.invoice.delete({ where: { id } });
  revalidatePath("/invoices");
  redirect("/invoices");
}

/* ========== 契約 ========== */
export async function saveContract(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  const intOrNull = (k: string) => {
    const v = formData.get(k);
    if (v == null || String(v).trim() === "") return null;
    return toInt(v);
  };
  const floatOrNull = (k: string) => {
    const v = formData.get(k);
    if (v == null || String(v).trim() === "") return null;
    return toFloat(v);
  };
  const data = {
    assignmentId: String(formData.get("assignmentId") || ""),
    contractNo: String(formData.get("contractNo") || "").trim(),
    contractType: String(formData.get("contractType") || "QUASI_MANDATE"),
    signedOn: toDate(formData.get("signedOn")),
    startOn: toDate(formData.get("startOn")),
    endOn: toDate(formData.get("endOn")),
    autoRenew: formData.get("autoRenew") === "on",
    status: String(formData.get("status") || "DRAFT"),
    note: String(formData.get("note") || "").trim() || null,
    paymentTermDays: intOrNull("paymentTermDays"), // 支払サイト（日数）。契約ごと

    // 単価
    rateType: String(formData.get("rateType") || "MONTHLY"),
    monthlyRate: toInt(formData.get("monthlyRate")),
    engineerRate: intOrNull("engineerRate"),
    engineerRateType: String(formData.get("engineerRateType") || "MONTHLY"),
    // 精算条件
    settlementType: String(formData.get("settlementType") || "RANGE"),
    lowerHours: intOrNull("lowerHours"),
    upperHours: intOrNull("upperHours"),
    fixedHours: intOrNull("fixedHours"),
    dailyStdHours: floatOrNull("dailyStdHours"),
    bufferHours: intOrNull("bufferHours"),
    // 控除・超過
    settlementMethod: String(formData.get("settlementMethod") || "MIDDLE"),
    deductionRate: intOrNull("deductionRate"),
    excessRate: intOrNull("excessRate"),
  };
  if (!data.assignmentId || !data.contractNo)
    throw new Error("対象アサインと契約番号は必須です。");
  if (id) await prisma.contract.update({ where: { id }, data });
  else await prisma.contract.create({ data });
  revalidatePath("/contracts");
  revalidatePath("/mypage");
  redirect("/contracts");
}

export async function deleteContract(formData: FormData) {
  await ensureAuth();
  const id = String(formData.get("id") || "");
  if (id) await prisma.contract.delete({ where: { id } });
  revalidatePath("/contracts");
  redirect("/contracts");
}

/* ========== 会社情報（請求元）設定 ========== */
export async function saveCompanySetting(formData: FormData) {
  const user = await ensureAuth();
  if (user.role !== "ADMIN") throw new Error("会社情報の編集は管理者のみ可能です。");
  const data = {
    name: String(formData.get("name") || "").trim(),
    registrationNumber: String(formData.get("registrationNumber") || "").trim(),
    postalCode: String(formData.get("postalCode") || "").trim(),
    address1: String(formData.get("address1") || "").trim(),
    address2: String(formData.get("address2") || "").trim(),
    tel: String(formData.get("tel") || "").trim(),
    banks: String(formData.get("banks") || "").replace(/\r\n/g, "\n").trim(),
    feeNote: String(formData.get("feeNote") || "").trim(),
  };
  if (!data.name) throw new Error("会社名は必須です。");
  await prisma.companySetting.upsert({
    where: { id: COMPANY_SINGLETON_ID },
    create: { id: COMPANY_SINGLETON_ID, ...data },
    update: data,
  });
  revalidatePath("/settings/company");
  revalidatePath("/invoices");
  redirect("/settings/company?saved=1");
}

/* ========== 営業活動 ========== */
export async function saveActivity(formData: FormData) {
  await ensureAuth();
  const data = {
    clientId: String(formData.get("clientId") || ""),
    type: String(formData.get("type") || "VISIT"),
    subject: String(formData.get("subject") || "").trim(),
    body: String(formData.get("body") || "").trim() || null,
    activityDate: toDate(formData.get("activityDate")) || new Date(),
    ownerName: String(formData.get("ownerName") || "").trim() || null,
  };
  if (!data.clientId || !data.subject) throw new Error("取引先と件名は必須です。");
  await prisma.salesActivity.create({ data });
  revalidatePath("/clients");
  redirect(`/clients/${data.clientId}`);
}

/* ========== 継続意思（エンジニア本人が延長/離脱を選択） ========== */
export async function respondRenewal(formData: FormData) {
  const user = await ensureAuth();
  const assignmentId = String(formData.get("assignmentId") || "");
  const intent = String(formData.get("intent") || "UNDECIDED");
  const renewalNote = String(formData.get("renewalNote") || "").trim() || null;
  if (!assignmentId) throw new Error("対象アサインが不正です。");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new Error("アサインが見つかりません。");

  // エンジニア本人 or 管理者/営業のみ操作可
  const myEngineerId = await getCurrentEngineerId();
  const isStaff = user.role === "ADMIN" || user.role === "SALES";
  if (!isStaff && assignment.engineerId !== myEngineerId) {
    throw new Error("この操作の権限がありません。");
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { renewalIntent: intent, renewalNote, renewalRespondedAt: new Date() },
  });
  revalidatePath("/mypage");
  revalidatePath("/assignments");
  redirect("/mypage");
}

/* ========== 案件オファー（営業 → エンジニア） ========== */
export async function createOffer(formData: FormData) {
  const user = await ensureAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES") {
    throw new Error("オファーの送信権限がありません。");
  }
  const engineerId = String(formData.get("engineerId") || "");
  const projectId = String(formData.get("projectId") || "");
  const message = String(formData.get("message") || "").trim() || null;
  const redirectTo = String(formData.get("redirectTo") || "/offers");
  if (!engineerId || !projectId) throw new Error("技術者と案件は必須です。");

  // 同一エンジニア×案件は1件（再オファー時は再オープン）
  await prisma.projectOffer.upsert({
    where: { engineerId_projectId: { engineerId, projectId } },
    update: { status: "OFFERED", message, engineerComment: null, respondedAt: null },
    create: { engineerId, projectId, message, status: "OFFERED" },
  });
  revalidatePath("/offers");
  revalidatePath("/mypage");
  redirect(redirectTo);
}

export async function respondOffer(formData: FormData) {
  const user = await ensureAuth();
  const offerId = String(formData.get("offerId") || "");
  const decision = String(formData.get("decision") || ""); // PROCEED / DECLINED
  const engineerComment = String(formData.get("engineerComment") || "").trim() || null;
  if (!offerId || !["PROCEED", "DECLINED"].includes(decision)) {
    throw new Error("回答内容が不正です。");
  }
  const offer = await prisma.projectOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("オファーが見つかりません。");

  // 本人のみ回答可（管理者代理も許可）
  const myEngineerId = await getCurrentEngineerId();
  const isStaff = user.role === "ADMIN" || user.role === "SALES";
  if (!isStaff && offer.engineerId !== myEngineerId) {
    throw new Error("この操作の権限がありません。");
  }

  await prisma.projectOffer.update({
    where: { id: offerId },
    data: { status: decision, engineerComment, respondedAt: new Date() },
  });
  revalidatePath("/mypage");
  revalidatePath("/offers");
  redirect("/mypage");
}

export async function withdrawOffer(formData: FormData) {
  const user = await ensureAuth();
  if (user.role !== "ADMIN" && user.role !== "SALES") {
    throw new Error("権限がありません。");
  }
  const offerId = String(formData.get("offerId") || "");
  if (offerId) {
    await prisma.projectOffer.update({
      where: { id: offerId },
      data: { status: "WITHDRAWN" },
    });
  }
  revalidatePath("/offers");
  revalidatePath("/mypage");
  redirect("/offers");
}

/* ========== スキルシート ========== */
/** 本人 or 営業/管理者のみ編集可。許可なら true */
async function canEditEngineer(engineerId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "SALES") return true;
  const myEngineerId = await getCurrentEngineerId();
  return myEngineerId === engineerId;
}

export async function saveSkillSheetProfile(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");

  await prisma.engineer.update({
    where: { id: engineerId },
    data: {
      initial: String(formData.get("initial") || "").trim() || null,
      ageRange: String(formData.get("ageRange") || "").trim() || null,
      nearestStation: String(formData.get("nearestStation") || "").trim() || null,
      availableFrom: toDate(formData.get("availableFrom")),
      finalEducation: String(formData.get("finalEducation") || "").trim() || null,
      prText: String(formData.get("prText") || "").trim() || null,
    },
  });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function addSkill(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const name = String(formData.get("skillName") || "").trim();
  const category = String(formData.get("category") || "OTHER");
  const level = toInt(formData.get("level")) || 3;
  if (!name) throw new Error("スキル名は必須です。");

  const skill = await prisma.skillTag.upsert({
    where: { name },
    update: {},
    create: { name, category },
  });
  await prisma.engineerSkill.upsert({
    where: { engineerId_skillId: { engineerId, skillId: skill.id } },
    update: { level },
    create: { engineerId, skillId: skill.id, level },
  });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function removeSkill(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const engineerSkillId = String(formData.get("engineerSkillId") || "");
  if (engineerSkillId) await prisma.engineerSkill.delete({ where: { id: engineerSkillId } });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function saveQualification(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("資格名は必須です。");
  await prisma.qualification.create({
    data: { engineerId, name, acquiredOn: toDate(formData.get("acquiredOn")) },
  });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function deleteQualification(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const id = String(formData.get("id") || "");
  if (id) await prisma.qualification.delete({ where: { id } });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function saveWorkHistory(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const id = String(formData.get("id") || "");
  const phases = formData.getAll("phases").map((p) => String(p)).filter(Boolean).join(",");
  const data = {
    engineerId,
    title: String(formData.get("title") || "").trim(),
    industry: String(formData.get("industry") || "").trim() || null,
    startOn: toDate(formData.get("startOn")),
    endOn: toDate(formData.get("endOn")),
    roleType: String(formData.get("roleType") || "SE"),
    teamSize: toInt(formData.get("teamSize")) || null,
    summary: String(formData.get("summary") || "").trim() || null,
    technologies: String(formData.get("technologies") || "").trim() || null,
    phases: phases || null,
    sortOrder: toInt(formData.get("sortOrder")),
  };
  if (!data.title) throw new Error("案件名/概要は必須です。");
  if (id) await prisma.workHistory.update({ where: { id }, data });
  else await prisma.workHistory.create({ data });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}

export async function deleteWorkHistory(formData: FormData) {
  await ensureAuth();
  const engineerId = String(formData.get("engineerId") || "");
  if (!(await canEditEngineer(engineerId))) throw new Error("編集権限がありません。");
  const id = String(formData.get("id") || "");
  if (id) await prisma.workHistory.delete({ where: { id } });
  revalidatePath(`/engineers/${engineerId}/skillsheet`);
  redirect(`/engineers/${engineerId}/skillsheet`);
}
