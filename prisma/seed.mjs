import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("シード開始…");

  // 既存データクリア（依存順）
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.salesActivity.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.engineerSkill.deleteMany();
  await prisma.skillTag.deleteMany();
  await prisma.user.deleteMany();
  await prisma.engineer.deleteMany();

  // ===== ユーザー =====
  const adminHash = await bcrypt.hash("admin1234", 10);
  const salesHash = await bcrypt.hash("sales1234", 10);
  await prisma.user.create({
    data: { email: "admin@ses-manager.local", passwordHash: adminHash, name: "管理者 太郎", role: "ADMIN" },
  });
  await prisma.user.create({
    data: { email: "sales@ses-manager.local", passwordHash: salesHash, name: "営業 花子", role: "SALES" },
  });
  // エンジニア本人ログイン用アカウントは技術者作成後に紐づける（後段で作成）

  // ===== スキルマスタ =====
  const skillDefs = [
    ["Java", "LANGUAGE"], ["Python", "LANGUAGE"], ["TypeScript", "LANGUAGE"], ["Go", "LANGUAGE"], ["PHP", "LANGUAGE"],
    ["Spring Boot", "FRAMEWORK"], ["React", "FRAMEWORK"], ["Next.js", "FRAMEWORK"], ["Vue", "FRAMEWORK"], ["Laravel", "FRAMEWORK"],
    ["PostgreSQL", "DB"], ["MySQL", "DB"], ["Oracle", "DB"],
    ["AWS", "CLOUD"], ["Azure", "CLOUD"], ["GCP", "CLOUD"],
    ["Linux", "INFRA"], ["Docker", "INFRA"], ["Kubernetes", "INFRA"],
    ["PM", "ROLE"], ["PL", "ROLE"], ["SE", "ROLE"], ["インフラ設計", "ROLE"],
  ];
  const skills = {};
  for (const [name, category] of skillDefs) {
    skills[name] = await prisma.skillTag.create({ data: { name, category } });
  }

  // ===== 技術者 =====
  const engDefs = [
    { code: "ENG-001", name: "山田 太郎", kana: "ヤマダ タロウ", emp: "EMPLOYEE", aff: "開発1部", status: "ASSIGNED", cost: 550000, sell: 750000, exp: 8, sk: ["Java", "Spring Boot", "AWS", "PL"] },
    { code: "ENG-002", name: "佐藤 花子", kana: "サトウ ハナコ", emp: "EMPLOYEE", aff: "開発1部", status: "ASSIGNED", cost: 500000, sell: 700000, exp: 6, sk: ["TypeScript", "React", "Next.js"] },
    { code: "ENG-003", name: "鈴木 一郎", kana: "スズキ イチロウ", emp: "EMPLOYEE", aff: "開発2部", status: "AVAILABLE", cost: 600000, sell: 850000, exp: 12, sk: ["Java", "PM", "PL", "Oracle"] },
    { code: "ENG-004", name: "田中 美咲", kana: "タナカ ミサキ", emp: "CONTRACT", aff: "開発2部", status: "AVAILABLE", cost: 450000, sell: 650000, exp: 4, sk: ["Python", "AWS", "Docker"] },
    { code: "ENG-005", name: "高橋 健", kana: "タカハシ ケン", emp: "BP", aff: "株式会社パートナーズ", status: "ASSIGNED", cost: 580000, sell: 720000, exp: 7, sk: ["PHP", "Laravel", "MySQL"] },
    { code: "ENG-006", name: "伊藤 さくら", kana: "イトウ サクラ", emp: "EMPLOYEE", aff: "インフラ部", status: "PARTIAL", cost: 520000, sell: 730000, exp: 9, sk: ["AWS", "Kubernetes", "Linux", "インフラ設計"] },
    { code: "ENG-007", name: "渡辺 大輔", kana: "ワタナベ ダイスケ", emp: "BP", aff: "テックソリューション株式会社", status: "AVAILABLE", cost: 480000, sell: 680000, exp: 5, sk: ["Go", "GCP", "Docker"] },
    { code: "ENG-008", name: "中村 由美", kana: "ナカムラ ユミ", emp: "EMPLOYEE", aff: "開発1部", status: "ASSIGNED", cost: 530000, sell: 720000, exp: 7, sk: ["Java", "Spring Boot", "PostgreSQL"] },
  ];

  const engineers = {};
  for (const e of engDefs) {
    const eng = await prisma.engineer.create({
      data: {
        code: e.code, name: e.name, nameKana: e.kana, employmentType: e.emp,
        affiliation: e.aff, status: e.status, costRate: e.cost, sellRateMin: e.sell,
        experienceYears: e.exp, joinedOn: new Date(2020, 3, 1),
        email: `${e.code.toLowerCase()}@ses-manager.local`,
      },
    });
    engineers[e.code] = eng;
    for (const sn of e.sk) {
      await prisma.engineerSkill.create({
        data: { engineerId: eng.id, skillId: skills[sn].id, level: 3 + (e.exp > 7 ? 1 : 0) },
      });
    }
  }

  // ===== エンジニア本人ログインアカウント（マイページ用） =====
  const engUserHash = await bcrypt.hash("eng1234", 10);
  const engUserDefs = [
    { code: "ENG-001", email: "yamada@ses-manager.local" }, // 稼働中（延長判断）
    { code: "ENG-003", email: "suzuki@ses-manager.local" }, // 待機中（オファー受信）
    { code: "ENG-005", email: "takahashi@ses-manager.local" }, // 稼働中（離脱希望デモ）
  ];
  for (const u of engUserDefs) {
    const eng = engineers[u.code];
    await prisma.user.create({
      data: {
        email: u.email, passwordHash: engUserHash, name: eng.name,
        role: "ENGINEER", engineerId: eng.id,
      },
    });
  }

  // ===== スキルシート（基本情報・資格・職務経歴）サンプル =====
  await prisma.engineer.update({
    where: { id: engineers["ENG-001"].id },
    data: {
      initial: "T.Y", ageRange: "30代", nearestStation: "新宿駅",
      availableFrom: new Date(2027, 3, 1), finalEducation: "〇〇大学 情報工学科 卒",
      prText: "Javaを中心としたWebアプリ開発を8年経験。Spring Bootによる業務システム構築とAWS上での運用設計が得意です。チームリーダーとして5名規模のチーム管理経験あり。",
    },
  });
  await prisma.qualification.createMany({
    data: [
      { engineerId: engineers["ENG-001"].id, name: "応用情報技術者試験", acquiredOn: new Date(2019, 11, 1) },
      { engineerId: engineers["ENG-001"].id, name: "AWS認定ソリューションアーキテクト – アソシエイト", acquiredOn: new Date(2022, 5, 1) },
    ],
  });
  await prisma.workHistory.createMany({
    data: [
      {
        engineerId: engineers["ENG-001"].id, sortOrder: 0,
        title: "大手保険会社 顧客管理システム再構築", industry: "金融・保険",
        startOn: new Date(2023, 3, 1), endOn: null, roleType: "PL", teamSize: 6,
        summary: "保険契約者向けの顧客管理システムをモノリスからマイクロサービスへ再構築。チームリーダーとして要件定義から参画し、設計・進捗管理を担当。",
        technologies: "Java, Spring Boot, PostgreSQL, AWS, Docker",
        phases: "REQUIREMENT,BASIC_DESIGN,DETAIL_DESIGN,IMPLEMENT,INTEGRATION_TEST",
      },
      {
        engineerId: engineers["ENG-001"].id, sortOrder: 1,
        title: "ECサイト 受注基盤開発", industry: "流通・小売",
        startOn: new Date(2021, 0, 1), endOn: new Date(2023, 2, 28), roleType: "SE", teamSize: 8,
        summary: "大規模ECサイトの受注・在庫連携基盤を開発。バッチ処理の性能改善で処理時間を60%短縮。",
        technologies: "Java, Spring Batch, Oracle, Linux",
        phases: "DETAIL_DESIGN,IMPLEMENT,UNIT_TEST,INTEGRATION_TEST",
      },
    ],
  });

  await prisma.engineer.update({
    where: { id: engineers["ENG-003"].id },
    data: {
      initial: "I.S", ageRange: "40代", nearestStation: "品川駅",
      finalEducation: "〇〇大学 経営工学科 卒",
      prText: "PM/PLとして金融系の大規模プロジェクトを多数経験。12年の経験を活かし、要件定義から本番稼働までの一貫したプロジェクト管理が可能です。",
    },
  });
  await prisma.qualification.createMany({
    data: [
      { engineerId: engineers["ENG-003"].id, name: "PMP", acquiredOn: new Date(2018, 2, 1) },
      { engineerId: engineers["ENG-003"].id, name: "データベーススペシャリスト試験", acquiredOn: new Date(2015, 11, 1) },
    ],
  });
  await prisma.workHistory.create({
    data: {
      engineerId: engineers["ENG-003"].id, sortOrder: 0,
      title: "メガバンク 勘定系システム保守・PMO", industry: "金融",
      startOn: new Date(2020, 3, 1), endOn: new Date(2026, 2, 31), roleType: "PM", teamSize: 20,
      summary: "勘定系システムの保守・改修プロジェクトのPMO。20名規模のベンダー管理、課題管理、品質管理を統括。",
      technologies: "Java, Oracle, Linux, JP1",
      phases: "REQUIREMENT,BASIC_DESIGN,SYSTEM_TEST,MAINTENANCE",
    },
  });

  // ===== 取引先 =====
  const clientDefs = [
    { name: "株式会社フューチャーシステムズ", kana: "フューチャーシステムズ", type: "END", contact: "情報システム部 部長", email: "info@future-sys.example.com", closing: 31, term: 30 },
    { name: "グローバルテック株式会社", kana: "グローバルテック", type: "PRIME", contact: "調達部 課長", email: "buy@globaltech.example.com", closing: 20, term: 60 },
    { name: "株式会社ネクストイノベーション", kana: "ネクストイノベーション", type: "END", contact: "DX推進室", email: "dx@nextinno.example.com", closing: 31, term: 45 },
  ];
  const clients = {};
  for (const c of clientDefs) {
    clients[c.name] = await prisma.client.create({
      data: {
        name: c.name, nameKana: c.kana, clientType: c.type, contactName: c.contact,
        contactEmail: c.email, closingDay: c.closing, paymentTermDays: c.term,
        address: "東京都千代田区",
      },
    });
  }

  // ===== 案件 =====
  const projDefs = [
    { code: "PRJ-001", title: "基幹システム刷新 / Javaエンジニア", client: "株式会社フューチャーシステムズ", ct: "QUASI_MANDATE", status: "ONGOING", min: 700000, max: 850000, count: 2, skills: "Java, Spring Boot, AWS", loc: "東京都港区（リモート併用）" },
    { code: "PRJ-002", title: "ECサイトフロントエンド開発", client: "株式会社ネクストイノベーション", ct: "QUASI_MANDATE", status: "ONGOING", min: 650000, max: 750000, count: 1, skills: "TypeScript, React, Next.js", loc: "フルリモート" },
    { code: "PRJ-003", title: "クラウド基盤構築 / インフラ", client: "グローバルテック株式会社", ct: "DISPATCH", status: "OPEN", min: 700000, max: 800000, count: 1, skills: "AWS, Kubernetes, Linux", loc: "東京都新宿区" },
    { code: "PRJ-004", title: "PMO支援 / プロジェクトマネージャー", client: "株式会社フューチャーシステムズ", ct: "QUASI_MANDATE", status: "PROPOSING", min: 800000, max: 950000, count: 1, skills: "PM, PL", loc: "東京都港区" },
    { code: "PRJ-005", title: "社内業務システム保守 / PHP", client: "グローバルテック株式会社", ct: "QUASI_MANDATE", status: "ONGOING", min: 650000, max: 750000, count: 1, skills: "PHP, Laravel, MySQL", loc: "東京都品川区（リモート併用）" },
  ];
  const projects = {};
  for (const p of projDefs) {
    projects[p.code] = await prisma.project.create({
      data: {
        code: p.code, title: p.title, clientId: clients[p.client].id, contractType: p.ct,
        status: p.status, unitPriceMin: p.min, unitPriceMax: p.max, requiredCount: p.count,
        requiredSkills: p.skills, workLocation: p.loc,
        startOn: new Date(2026, 3, 1), endOn: new Date(2027, 2, 31),
        description: `${p.title}の案件です。長期での参画を想定しています。`,
      },
    });
  }

  // ===== アサイン =====
  const asgDefs = [
    { eng: "ENG-001", prj: "PRJ-001", status: "ACTIVE", sell: 780000, cost: 550000 },
    { eng: "ENG-008", prj: "PRJ-001", status: "ACTIVE", sell: 740000, cost: 530000 },
    { eng: "ENG-002", prj: "PRJ-002", status: "ACTIVE", sell: 720000, cost: 500000 },
    { eng: "ENG-005", prj: "PRJ-005", status: "ACTIVE", sell: 720000, cost: 580000 },
    { eng: "ENG-003", prj: "PRJ-004", status: "PROPOSED", sell: 900000, cost: 600000 },
    { eng: "ENG-006", prj: "PRJ-003", status: "INTERVIEW", sell: 760000, cost: 520000 },
  ];
  // 本人の継続意思サンプル（延長/離脱/未回答）
  const renewalByEng = {
    "ENG-001": { intent: "EXTEND", note: "現場に慣れてきたので、同条件以上で延長を希望します。" },
    "ENG-005": { intent: "LEAVE", note: "次はモダンな技術スタックに挑戦したく、契約満了で離脱を希望します。" },
  };
  const assignments = [];
  for (const a of asgDefs) {
    const r = renewalByEng[a.eng] || {};
    const asg = await prisma.assignment.create({
      data: {
        engineerId: engineers[a.eng].id, projectId: projects[a.prj].id, status: a.status,
        sellRate: a.sell, costRate: a.cost,
        startOn: new Date(2026, 3, 1), endOn: new Date(2027, 2, 31),
        standardHoursMin: 140, standardHoursMax: 180,
        renewalIntent: r.intent || "UNDECIDED",
        renewalNote: r.note || null,
        renewalRespondedAt: r.intent ? new Date() : null,
      },
    });
    assignments.push({ ...a, id: asg.id });
  }

  // ===== 案件オファー（営業 → 待機エンジニア宛て） =====
  const offerDefs = [
    { eng: "ENG-003", prj: "PRJ-004", status: "OFFERED", msg: "鈴木さんのPM経験を高く評価いただける案件です。単価も好条件です。" },
    { eng: "ENG-004", prj: "PRJ-003", status: "OFFERED", msg: "AWS/Dockerのご経験が活きるクラウド基盤案件です。ご検討ください。" },
    { eng: "ENG-007", prj: "PRJ-003", status: "PROCEED", msg: "Go/GCPのスキルマッチ案件です。", comment: "ぜひ進めたいです。面談調整お願いします。" },
  ];
  for (const o of offerDefs) {
    await prisma.projectOffer.create({
      data: {
        engineerId: engineers[o.eng].id, projectId: projects[o.prj].id,
        status: o.status, message: o.msg,
        engineerComment: o.comment || null,
        respondedAt: o.status === "PROCEED" || o.status === "DECLINED" ? new Date() : null,
      },
    });
  }

  // ===== 契約（稼働中アサインに付与。精算条件3パターンを実演）=====
  // 精算パターン定義（アサインの技術者コード別）
  const contractSettlements = {
    // 上限・下限 ＋ 中間割。提示単価=実単価より低く設定（二重単価の実演）
    "ENG-001": {
      monthlyRate: 780000, engineerRate: 700000,
      settlementType: "RANGE", lowerHours: 140, upperHours: 180,
      settlementMethod: "MIDDLE",
    },
    // 営業日数×標準時間±バッファ ＋ 上下割
    "ENG-008": {
      monthlyRate: 740000, engineerRate: 700000,
      settlementType: "BUSINESSDAY_BUFFER", dailyStdHours: 8, bufferHours: 20,
      settlementMethod: "UPPER_LOWER",
    },
    // 上限・下限 ＋ 個別指定（控除・超過を直接設定）
    "ENG-002": {
      monthlyRate: 720000, engineerRate: 680000,
      settlementType: "RANGE", lowerHours: 150, upperHours: 190,
      settlementMethod: "MANUAL", deductionRate: 4500, excessRate: 3800,
    },
    // 時給契約（実時給4,500/h）だが、本人へは月額¥700,000で提示（提示額の単位=月額）
    "ENG-005": {
      rateType: "HOURLY",
      monthlyRate: 4500, engineerRate: 700000, engineerRateType: "MONTHLY",
      settlementType: "FIXED", fixedHours: null,
      settlementMethod: "NONE",
    },
  };
  let ctSeq = 1;
  for (const a of assignments.filter((x) => x.status === "ACTIVE")) {
    const s = contractSettlements[a.eng] || {
      monthlyRate: a.sell, engineerRate: null,
      settlementType: "RANGE", lowerHours: 140, upperHours: 180, settlementMethod: "MIDDLE",
    };
    await prisma.contract.create({
      data: {
        assignmentId: a.id, contractNo: `CT-2026-${String(ctSeq++).padStart(3, "0")}`,
        contractType: "QUASI_MANDATE", status: "SIGNED", autoRenew: true,
        signedOn: new Date(2026, 2, 20), startOn: new Date(2026, 3, 1), endOn: new Date(2027, 2, 31),
        rateType: s.rateType || "MONTHLY",
        monthlyRate: s.monthlyRate, engineerRate: s.engineerRate ?? null,
        engineerRateType: s.engineerRateType || "MONTHLY",
        settlementType: s.settlementType,
        lowerHours: s.lowerHours ?? null, upperHours: s.upperHours ?? null,
        fixedHours: s.fixedHours ?? null,
        dailyStdHours: s.dailyStdHours ?? null, bufferHours: s.bufferHours ?? null,
        settlementMethod: s.settlementMethod,
        deductionRate: s.deductionRate ?? null, excessRate: s.excessRate ?? null,
      },
    });
  }

  // ===== 工数（当月・前月）=====
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  for (const a of assignments.filter((x) => x.status === "ACTIVE")) {
    await prisma.timesheet.create({
      data: { assignmentId: a.id, yearMonth: prevYm, workedHours: 160, status: "APPROVED" },
    });
    await prisma.timesheet.create({
      data: { assignmentId: a.id, yearMonth: thisYm, workedHours: 152, status: "SUBMITTED" },
    });
  }

  // ===== 請求（前月分を取引先ごとに生成）=====
  const activeAsg = await prisma.assignment.findMany({
    where: { status: "ACTIVE" },
    include: { engineer: true, project: { include: { client: true } } },
  });
  const byClient = new Map();
  for (const a of activeAsg) {
    const cid = a.project.clientId;
    if (!byClient.has(cid)) byClient.set(cid, []);
    byClient.get(cid).push(a);
  }
  let invSeq = 1;
  for (const [clientId, list] of byClient) {
    const items = list.map((a) => ({
      assignmentId: a.id,
      description: `${a.engineer.name}／${a.project.title}（${prevYm} 稼働分）`,
      unitPrice: a.sellRate, quantity: 1, amount: a.sellRate,
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxAmount = Math.floor(subtotal * 0.1);
    await prisma.invoice.create({
      data: {
        invoiceNo: `INV-${prevYm.replace("-", "")}-${String(invSeq++).padStart(3, "0")}`,
        clientId, yearMonth: prevYm, status: "ISSUED",
        issueDate: new Date(now.getFullYear(), now.getMonth(), 1),
        subtotal, taxRate: 10, taxAmount, total: subtotal + taxAmount,
        items: { create: items },
      },
    });
  }

  // ===== 営業活動 =====
  await prisma.salesActivity.create({
    data: {
      clientId: clients["株式会社フューチャーシステムズ"].id, type: "VISIT",
      subject: "次期フェーズの増員相談", body: "下期に向けてJavaエンジニア2名の増員を打診。来月提案予定。",
      ownerName: "営業 花子",
    },
  });
  await prisma.salesActivity.create({
    data: {
      clientId: clients["グローバルテック株式会社"].id, type: "PROPOSAL",
      subject: "インフラ案件への提案", body: "PRJ-003 に伊藤さくらを提案。単価760,000で調整中。",
      ownerName: "営業 花子",
    },
  });

  console.log("シード完了 ✅");
  console.log("ログイン: admin@ses-manager.local / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
