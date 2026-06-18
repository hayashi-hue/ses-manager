// 請求元（自社）情報。管理メニュー（/settings/company）から編集可能。
// DB(CompanySetting シングルトン)に保存し、未設定時は DEFAULT_COMPANY を使用する。
// ロゴ・角印画像のパスは固定（public/company/）。
import { prisma } from "./db";

export type CompanyInfo = {
  name: string;
  registrationNumber: string;
  postalCode: string;
  address1: string;
  address2: string;
  tel: string;
  banks: string[]; // 振込先（複数行）
  feeNote: string;
  logoPath: string;
  sealPath: string;
};

const ASSETS = { logoPath: "company/logo.png", sealPath: "company/seal.png" };

export const COMPANY_SINGLETON_ID = "default";

export const DEFAULT_COMPANY: CompanyInfo = {
  name: "株式会社ラポールスター",
  registrationNumber: "T4010001197608",
  postalCode: "108-0075",
  address1: "東京都港区港南2-16-4",
  address2: "品川グランドセントラルタワー17階",
  tel: "050-5052-1028",
  banks: [
    "みずほ銀行 赤坂支店 普通 3008425 カ）ラポールスター",
    "住信SBIネット銀行 法人第一支店 普通 1764070 カ）ラポールスター",
  ],
  feeNote: "※恐れ入りますが、振込手数料はご負担ください",
  ...ASSETS,
};

/** 請求書出力に使う会社情報（DB→無ければ既定値）。テーブル未作成でも既定値で動作。 */
export async function getCompany(): Promise<CompanyInfo> {
  try {
    const row = await prisma.companySetting.findUnique({
      where: { id: COMPANY_SINGLETON_ID },
    });
    if (!row) return DEFAULT_COMPANY;
    return {
      name: row.name || DEFAULT_COMPANY.name,
      registrationNumber: row.registrationNumber,
      postalCode: row.postalCode,
      address1: row.address1,
      address2: row.address2,
      tel: row.tel,
      banks: row.banks
        ? row.banks.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
      feeNote: row.feeNote,
      ...ASSETS,
    };
  } catch {
    // CompanySetting テーブル未作成（db push 前）等は既定値で継続
    return DEFAULT_COMPANY;
  }
}

/** 設定画面の初期値（banks は改行区切り文字列）。 */
export async function getCompanyForm() {
  try {
    const row = await prisma.companySetting.findUnique({
      where: { id: COMPANY_SINGLETON_ID },
    });
    if (row) {
      return {
        name: row.name,
        registrationNumber: row.registrationNumber,
        postalCode: row.postalCode,
        address1: row.address1,
        address2: row.address2,
        tel: row.tel,
        banks: row.banks,
        feeNote: row.feeNote,
      };
    }
  } catch {
    /* 未作成時は既定値 */
  }
  return {
    name: DEFAULT_COMPANY.name,
    registrationNumber: DEFAULT_COMPANY.registrationNumber,
    postalCode: DEFAULT_COMPANY.postalCode,
    address1: DEFAULT_COMPANY.address1,
    address2: DEFAULT_COMPANY.address2,
    tel: DEFAULT_COMPANY.tel,
    banks: DEFAULT_COMPANY.banks.join("\n"),
    feeNote: DEFAULT_COMPANY.feeNote,
  };
}
