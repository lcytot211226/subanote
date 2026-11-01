<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Subanote(個人記帳 Web App)

一個使用 Next.js + MongoDB 打造的自訂記帳網站。核心是信用卡分期/訂閱扣款管理與房租水電紀錄,並延伸出訂閱惰性生成交易、跨帳號項目分享、系統公告通知、信用卡對帳追蹤、每日可花預算等功能;具備單一入口登入驗證、深色/淺色模式與 RWD 響應式設計(手機也能正常使用)。

> 本節(技術棧以下)是「現況文件」,會隨程式碼一起維護,反映目前實際的實作,而不是最初的需求規格。

## 技術棧

- **Framework**: Next.js (App Router),前後端皆使用 Next.js(API Routes / Route Handlers 作為後端)。這個版本的 Next.js 用 `proxy.ts`(而非傳統的 `middleware.ts`)實作請求層攔截,細節見下方「認證與存取控制」。
- **Database**: MongoDB,透過 Mongoose 定義 Schema(`lib/models/*.ts`)
- **樣式**: Tailwind CSS(RWD + dark/light mode)
- **Auth**: 自寫的輕量 Credentials 驗證(`lib/auth.ts`):bcryptjs 雜湊密碼、`jose` 簽發/驗證 JWT,存在 httpOnly cookie 做 session,沒有串接 NextAuth.js 或任何第三方登入
- **Email**: Resend(`lib/email.ts`),寄送註冊 / 忘記密碼的 6 碼驗證碼
- **圖表**: Recharts(`components/OverviewChart.tsx`)

## 環境變數

在專案根目錄建立 `.env.local`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<dbname>?retryWrites=true&w=majority
JWT_SECRET=<自訂一組亂數字串,用於簽發登入 token>
EMAIL_KEY=<Resend API Key,用於寄送註冊 / 忘記密碼的驗證碼信件>
```

> 請勿將 `.env.local` 提交到 git(已加入 `.gitignore`)。
>
> 管理員帳號(唯一能使用 `/admin` 後台發布系統公告的帳號)是寫死在 `lib/auth.ts` 的 `ADMIN_EMAIL` 常數,不是環境變數;要換人需要直接改程式碼。

## 認證與存取控制

- 密碼一律用 `bcryptjs` 雜湊(`hashPassword`/`verifyPassword`),絕不存明文。
- 登入成功後用 `jose` 簽發 JWT(payload:`email`、`ver`、`chk`,`sub` 放 `userId`),存進名為 `auth_token` 的 httpOnly cookie,效期 30 天。
- **登入狀態可撤銷**(`lib/auth.ts` 的 `validateSession()`):驗簽章與效期不碰資料庫;`ver` 是簽發時的 `User.tokenVersion`,`chk` 是上次跟資料庫確認的時間,距今超過 `SESSION_RECHECK_SECONDS`(30 分鐘)才查一次資料庫比對版本,對不上就視為登出,對得上就換發 `chk` 更新的新 token。**沒查資料庫時換發的 token 一律沿用原本的 `chk`**,否則偷來的 token 只要一直使用就永遠不會被檢查。改密碼、重設密碼、登出所有裝置時 `tokenVersion` +1,其他裝置最晚 30 分鐘內被登出(改密碼的那台會立刻換發新版本號的 token,不會被踢)。沒有 `ver`/`chk` 的舊格式 token 視為 `ver = 0`、`chk = 0`。
- `proxy.ts`(取代舊版 Next.js 的 `middleware.ts`)攔截除了 `/`、`/login`、`/register`、`/verify-email`、`/forgot-password` 以外的所有頁面請求:沒有合法 token 就導回 `/login`;驗證通過(含上面的版本確認)則**每次請求都重新簽發 cookie**,達成 sliding session——只要 30 天內有造訪過就會一直維持登入,不需要手動重新登入;新 token 也透過 `NextResponse.next({ request: { headers } })` 帶進這次請求,頁面的 Server Component 讀到的就是剛確認過的 token。無效 / 已撤銷的 token 導回 `/login` 並清掉 cookie。`proxy.ts` 的 `matcher` 排除了 `/api/**`,所以 API 路由各自呼叫 `requireAuth()`/`getCurrentUser()`(`lib/auth.ts`)檢查登入狀態,未登入回傳 401。
- 帳號啟用前(`emailVerified = false`)無法登入,登入 API 會回傳 `403 + needsVerification: true`,前端導向 `/verify-email`。
- `/admin` 底下的頁面與 `app/api/admin/**` 的 API,除了要登入以外還要求 `email === ADMIN_EMAIL`,否則導回 `/overview`(頁面)或回傳 403(API)。
- 註冊**不限制帳號數量**,任何 email 都可以註冊。
- **防暴力破解與濫用**(數字集中在 `lib/security.ts`):
  - 驗證碼(註冊啟用 / 重設密碼共用)每組最多試 `OTP_MAX_ATTEMPTS` = 5 次,用完就作廢須重寄;`consumeVerificationCode()` 先原子地把 `User.verificationAttempts` +1 再比對雜湊,大量並發請求也不會超過 5 次。錯誤訊息統一,不透露剩幾次。
  - 寄信(註冊 / 重寄驗證碼 / 忘記密碼):同一個 email 重寄間隔 60 秒、每小時 5 封,同一個 IP 每小時 20 封,超過回 429 + `Retry-After`;忘記密碼被限制時照樣回成功、只是不寄,避免洩漏帳號是否存在。
  - 登入:同一個 email + IP 連續輸錯 3 次鎖 10 分鐘(從最後一次失敗起算,鎖定期間不比對密碼),同一個 email 不分 IP 每小時錯 20 次也鎖;帳號不存在也照樣計數。登入成功清掉該 email + IP 的連續失敗計數。
  - 計數存在 `RateLimit` collection(`lib/rateLimit.ts`),IP 取自 `x-forwarded-for` 第一個值(部署平台設定;本機沒有則為 `unknown`)。

## 資料庫結構

共十二個 collection:`User`、`Card`、`Transaction`、`Subscription`、`Utility`、`CustomItem`、`CardReconciliation`、`OverviewSummary`、`Share`、`Notification`、`RewardPlan`、`RateLimit`。除了 `User`、全站共用的 `Notification` 和 `RateLimit` 外,其餘每個 collection 都有 `user`(`ObjectId`,參照 `User._id`)欄位做資料隔離,所有 API 查詢也一律加上 `user: auth.userId` 條件,確保使用者只能讀寫自己的資料。

### User(帳號)

```ts
{
  _id: ObjectId,
  email: string,          // 唯一
  password: string,       // bcrypt hash 過,不可存明文
  createDate: Date,       // 註冊時間
  specialDate: number | undefined, // DD,1-31,使用者自訂的「月結算日」(選填);/settings 可設定/清除
  emailVerified: boolean, // 是否已完成 email 驗證碼啟用,預設 false
  verificationCodeHash: string | null,   // 註冊啟用 / 忘記密碼共用的 6 碼驗證碼(bcrypt hash 過),驗證成功或過期後清空
  verificationCodeExpires: Date | null,  // 驗證碼有效期限(10 分鐘)
  verificationAttempts: number,          // 目前這組驗證碼已試幾次,滿 5 次作廢;寄新碼時歸零(舊資料沒有視為 0)
  tokenVersion: number,                  // 登入狀態版本號,放進 token 的 ver;改密碼 / 重設密碼 / 登出所有裝置時 +1(舊資料沒有視為 0)
  notificationRead: boolean, // 是否已讀最新一則系統公告,預設 true;管理員發布新公告時全體使用者會被重置為 false
  createdAt: Date,
  updatedAt: Date
}
```

> **註冊規則**:
> - 提供簡單的註冊頁面(email + password),不限制帳號數量
> - 註冊後用 Resend(`.env.local` 的 `EMAIL_KEY`)寄送 6 位數驗證碼到指定信箱,10 分鐘內輸入正確驗證碼(`/verify-email` 頁面)才會正式啟用帳號(`emailVerified = true`)。同一 email 若尚未啟用就重新註冊,視為重寄驗證碼並套用新密碼,不會擋下來。
> - 帳號尚未啟用時嘗試登入,會回傳 `403 + needsVerification: true`,前端自動導向 `/verify-email` 輸入驗證碼(可在該頁重新寄送)
> - 忘記密碼(`/forgot-password`):輸入 email 寄送驗證碼,驗證碼與新密碼一起送出後更新密碼,同時視為完成 email 驗證。無論帳號是否存在都回傳成功,避免洩漏 email 是否已註冊。
> - 登入後用 JWT 存在 httpOnly cookie(sliding session,見上方「認證與存取控制」),所有頁面(除了 `/`、`/login`、`/register`、`/verify-email`、`/forgot-password`)都需要驗證身份,未登入導回 `/login`
> - `specialDate`(月結算日)的實際用途:`/overview` 用它算出「距離下次結算日還有幾天」,再用「本月結餘 ÷ 剩餘天數」算出每日可花預算(`lib/calculateDailyBudget.ts`);沒設定時 `/overview` 該處顯示設定提示,可直接在總覽頁設定。

### Card(信用卡)

```ts
{
  _id: ObjectId,
  user: ObjectId,         // 參照 User._id
  name: string,           // 卡片名稱,例如「國泰CUBE卡」
  isDebit: boolean,       // 是否為簽帳金融卡,預設 false(舊資料沒有此欄位視為 false);只能在新增時決定,之後不能更改
  closingDate?: number,   // 結帳日,1-31;簽帳金融卡沒有這個欄位
  paymentDate?: number,   // 繳款日,1-31;簽帳金融卡沒有這個欄位
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction(交易紀錄)

```ts
{
  _id: ObjectId,
  user: ObjectId,                    // 參照 User._id
  type: "income" | "expense",       // 收入 / 支出
  date: Date,                        // 實際交易發生日期
  category: "installment" | "cash" | "credit_card", // 付款方式:分期 / 現金 / 信用卡(單筆)
  item: string,                      // 項目名稱,例如「聚餐」「筆電分期」
  kind?: string,                     // 分類。支出:food / entertainment / shop / transport / medical / learning / sport / other(食物 / 娛樂 / 商店 / 交通 / 醫療 / 學習 / 運動 / 其他,`lib/expenseKind.ts`);收入:salary / bonus / transfer / other(薪水 / 獎金 / 轉帳 / 其他,`lib/incomeKind.ts`)。兩組的共用邏輯在 `lib/transactionKind.ts`:API 檢查分類跟 type 對得上(`isKindFor`),沒帶預設「其他」,讀取時缺欄位或對不上也視為「其他」(`kindOf()`);改收支類型時原分類對不上會改成「其他」。同一組分期共用同一個分類,編輯其中一期的分類會整組一起改;訂閱生成的交易沿用該訂閱的 `kind`。舊資料已依品項名稱判定後一次補上(一次性遷移腳本含使用者資料,放在不進版控的 `tmp/`)
  card: ObjectId | null,             // 關聯的信用卡(category 為 credit_card 或 installment 時使用),參照 Card._id
  installmentInfo: {                 // 僅 category = installment 時使用
    currentNumber: number,           // 目前第幾期
    totalNumber: number              // 總共幾期
  } | null,
  amount: number,                    // 金額
  pointsDiscount?: number,           // 點數折抵(選填),僅 type = expense 且 category = credit_card 且有折抵(> 0)時才存在,其餘交易沒有這個欄位;實際計入所有統計的金額 = amount - pointsDiscount(`lib/pointsDiscount.ts` 的 `netAmount()`)
  posted: boolean,                   // 是否已在結帳日當下成功入帳(預設 true)。若為 false,代表結帳當下銀行還沒處理,要再往後遞延一個月
  billingPeriod: string,             // 計算後的歸屬月份,格式 "YYYY-MM",此筆交易會顯示在哪個月份頁面,由下方邏輯計算後存入(方便查詢,避免每次都要重算)
  installmentGroupId: ObjectId | null, // 同一次分期購買生成的所有期數共用同一個 id,刪除其中一期會整組一起刪
  subscription: ObjectId | null,     // 若此筆是由訂閱惰性生成,記錄來源 Subscription._id;之後訂閱被編輯/刪除都不會回頭修改這筆
  createdAt: Date,
  updatedAt: Date
}
```

#### 「歸屬月份 (billingPeriod)」計算邏輯 — 重要

記帳頁面是以「這筆錢什麼時候實際入帳/繳費」為主,而不是單純以消費日期分類。規則如下:

1. **現金交易(category = "cash")**:不需要跑結帳邏輯,`billingPeriod` 直接等於交易日期所在的月份。

2. **信用卡 / 分期交易(category = "credit_card" 或 "installment")**,需要根據關聯卡片的 `closingDate` 與 `paymentDate` 計算:
   - **Step 1:找出這筆交易歸屬的「結帳週期」**
     - 若交易日的「日」 ≤ 卡片的 `closingDate`,則此交易算在「交易當月」的結帳週期內。
     - 若交易日的「日」 > 卡片的 `closingDate`,則此交易算在「交易下個月」的結帳週期內。
   - **Step 2:根據結帳週期,計算實際繳款月份**
     - 若卡片的 `paymentDate`(日)≤ `closingDate`(日),代表繳款日在結帳後的「下一個月」。
     - 若 `paymentDate` > `closingDate`,代表繳款日在「結帳當月」。
   - **Step 3:若 `posted = false`(該期結帳日當下未入帳),則在 Step 2 算出的月份基礎上,再往後遞延一個月。**
   - 最終算出的月份即為 `billingPeriod`。

   **範例**:8/10 消費,卡片 `closingDate=15`、`paymentDate=3`
   - Step 1:10 ≤ 15 → 結帳週期 = 8 月(8/15 結帳)
   - Step 2:paymentDate(3) ≤ closingDate(15) → 繳款月份 = 結帳月的下個月 = **9 月**
   - Step 3:若 `posted = true` → `billingPeriod = "2026-09"`;若 `posted = false`(15 號沒入帳)→ 再延一個月 → `billingPeriod = "2026-10"`

   這段邏輯實作在 `lib/calculateBillingPeriod.ts` 的 `calculateBillingPeriod()`,在新增/編輯交易、切換 `posted` 狀態、生成分期或訂閱交易時都會重新呼叫並存回 `billingPeriod` 欄位。

3. **簽帳金融卡(關聯卡片 `isDebit = true`)**:不管 category 是什麼,都跟現金一樣直接取交易日期所在月份,不跑結帳邏輯,也不受 `posted` 影響(交易表單選到簽帳金融卡時不顯示「結帳日當下已入帳」)。各 API 一律用 `toCardBillingInfo(cardDoc)` 把卡片轉成計算用的資訊。

### Subscription(訂閱 / 固定月付項目)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  item: string,                      // 項目名稱,例如「Netflix」「房間清潔訂閱」
  kind: "food" | "entertainment" | ... | "other", // 支出分類(同 Transaction.kind),預設「其他」;之後生成的每一期都沿用,改分類不會回頭改已生成的交易
  amount: number,
  category: "cash" | "credit_card",  // 訂閱不支援分期
  card: ObjectId | null,             // category = credit_card 時使用,參照 Card._id
  startDate: Date,                   // 首次扣款日期,之後每月同一天重複扣款(短月自動夾到月底)
  lastGeneratedDate: Date | null,    // 已經生成到哪一次扣款日,避免重複生成
  createdAt: Date,
  updatedAt: Date
}
```

> **惰性生成邏輯**(`lib/generateSubscriptionTransactions.ts` 的 `generateDueSubscriptionTransactions()`):不是用排程/cron 定期產生交易,而是每次讀取交易列表(`GET /api/transactions`)、或新增/編輯/刪除訂閱時觸發——把每個訂閱從 `lastGeneratedDate` 之後、到「今天」為止已經到期的每個月扣款,依序補生成成真正的 `Transaction`(`type: "expense"`,`subscription` 欄位指向來源訂閱),並用 `calculateBillingPeriod` 算出各期的 `billingPeriod`。每期日期一律用 `addMonthsClamped(startDate, k)` 從原始 `startDate` 重新推算,而不是拿上一期日期繼續往後加一個月,避免「1/31 訂閱在 2 月被夾到 28 號後,之後每個月都回不去 31 號」的日期漂移問題。訂閱之後被編輯或刪除,已經生成出來的交易都是獨立紀錄,不會被回頭改動或刪除。

### Utility(房租電費)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  year: number,           // 年份
  month: number,          // 月份 1-12
  date: number,           // DD,帳單日期
  rent: number,           // 租金
  rentEnabled: boolean,   // 租金是否計入本月統計,預設 true
  elecEnabled: boolean,   // 電費是否計入本月統計,預設 true
  waterEnabled: boolean,  // 水費是否計入本月統計,預設 true
  enabled: boolean,       // 總開關:關閉時本月房租水電完全不計入統計,但不影響/清空上面三個個別開關,重新打開會恢復原狀
  paid: boolean,          // 是否已繳費,預設 false;純進度標記,不影響任何金額統計,只透過 PATCH /api/utilities 切換
  elec: {
    start: number,        // 電表起始度數
    end: number,          // 電表結束度數
    unitPrice: number,    // 每度單價
    manualAmount: number | null // 若有值則直接以此金額為準,略過度數 × 單價的計算
  },
  water: {                // 結構同 elec,水費
    start: number,
    end: number,
    unitPrice: number,
    manualAmount: number | null
  },
  createdAt: Date,
  updatedAt: Date
}
```

> 每個 `(user, year, month)` 只會有一筆(unique index),`/overview` 的房租水電 inline 編輯是用 `PUT /api/utilities`(不帶 id,依 year+month upsert)整份覆寫。金額計算見 `lib/calculateMeterCost.ts`:`manualAmount` 有值就直接用它,否則用 `max(0, end - start) × unitPrice`;計入統計(月度彙總、房租水電總額)的 `calculateMeterCost()` 一律四捨五入到整數,含小數的實際金額(`calculateMeterCostExact()`)只用於畫面上點擊查看。

### CustomItem(自訂月費項目)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  year: number,
  month: number,   // 1-12
  name: string,    // 例如「孝親費」
  amount: number,
  date?: number,   // DD(選填),必須是該月存在的日子(`lib/customItemDate.ts` 驗證);只是記錄用,不影響歸屬月份,沒填就沒有這個欄位
  createdAt: Date,
  updatedAt: Date
}
```

> 使用者自行決定某個月要不要新增,不是每月固定存在的項目,用來記錄不方便歸類成一般交易或訂閱的月費開銷,計入該月支出總額。

### CardReconciliation(信用卡對帳紀錄)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  card: ObjectId,  // 參照 Card._id
  period: string,  // "YYYY-MM"
  status: "reconciled" | "paid", // 已對帳 / 已繳費,預設 "reconciled"(舊資料沒有此欄位也視為已對帳)
  createdAt: Date,
  updatedAt: Date
}
```

> 對帳進度分三段:未對帳 → 已對帳(`reconciled`)→ 已繳費(`paid`)。「未對帳」不存狀態,用「這筆紀錄不存在」表示,回到未對帳就直接刪掉這筆紀錄;`(user, card, period)` 是 unique index。

### OverviewSummary(每月彙總快取,供分享使用)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  period: string,      // "YYYY-MM"
  income: number,
  expense: number,     // 現金 + 分期 + 信用卡單筆交易 + 房租水電 + 自訂項目
  cash: number,
  installment: number,
  subscription: number,
  utility: number,
  customItems: number,
  balance: number,     // income - expense
  cards: [{ card: ObjectId, total: number }],  // 每張信用卡當月刷卡總額
  items: [{ key: string, amount: number }],    // 可分享項目快照,key 見下方 Share 說明
  createdAt: Date,
  updatedAt: Date
}
```

> `(user, period)` 是 unique index。這是一份**衍生/快取資料**,不是使用者直接輸入的來源資料——交易、房租水電、自訂項目任何一筆異動,對應 API route 都會呼叫 `lib/recomputeOverviewSummary.ts` 的 `recomputeOverviewSummary(userId, period)` 重新從原始資料算一次並整份覆寫,讓別人讀我的分享項目(`GET /api/shares/incoming`)時只要查一筆快取,不用拉我整個月的原始資料;若某個月從未被計算過(沒有快取),讀取時(`lib/getOverviewSummary.ts`)會即時算一次並補上。
>
> **我自己的 `/overview` 月檢視不讀這份快取**(年度檢視 `GET /api/overview/year` 才讀),而是用前端已經抓回來的當月交易 / 房租水電 / 自訂項目現場加總(交易列表 API 回傳前已補生成到期的訂閱,所以一定包含最新的訂閱扣款,不會跟快取有時間差)。計算邏輯集中在純函式 `lib/summarizeMonth.ts` 的 `summarizeMonth()`(不碰資料庫),前端現場算與後端 `recomputeOverviewSummary`(經 `lib/computeMonthSummary.ts` 查原始資料)共用同一份,數字一定一致。`items` 裡的 `key` 只存代碼(例如 `"cash"`、`"card:<cardId>"`),顯示用的 label 一律由 API 層透過 `lib/overviewItems.ts` 的 `labelForItemKey()` 依 key 即時解析,避免卡片改名後舊快照裡的名稱跟著過期。

### Share(跨帳號項目分享)

```ts
{
  _id: ObjectId,
  owner: ObjectId,       // 分享者,參照 User._id
  targetEmail: string,   // 收件人 email,不需要對方已註冊
  itemKey: string,       // "cash" | "installment" | "subscription" | "utility" | "customItems" | "card:<cardId>"
  included: boolean,     // 收件人是否選擇把這筆分享納入自己的收支統計,預設 false
  createdAt: Date,
  updatedAt: Date
}
```

> `(owner, targetEmail, itemKey)` 是 unique index。分享者把自己 `OverviewSummary` 裡某個固定項目(收入/支出/結餘/現金/分期/訂閱/房租水電/自訂項目)或某張信用卡的當月總額分享給任一 email;原始資料仍歸屬分享者,收件人登入後在自己的 `/overview` 看到這筆分享,可自行決定 `included` 要不要把金額納入自己的收支計算(不會真的寫成一筆交易,純粹是顯示/統計層的虛擬項目)。金額不落地存放,`GET /api/shares/incoming` 每次都即時從分享者當月的 `OverviewSummary` 讀取,永遠反映最新狀態。收件人納入的分享項目**收入與支出分開加總**,規則集中在 `lib/overviewItems.ts` 的 `includedSharedTotals()`:`income` 加進收入;`expense` 與其他開銷類(現金 / 分期 / 訂閱 / 房租水電 / 自訂項目 / 信用卡)加進支出;`balance`(結餘)代表分享者的收入和支出都抓,分別加進收入與支出(所以 `GET /api/shares/incoming` 的結餘項目會多帶 `income`、`expense` 兩個欄位)。同一個分享者的項目會去掉明顯重疊:選了結餘就不再加他的其他項目,選了支出就不再加開銷類分項;分項之間本身的重疊(例如分期也算在某張信用卡裡)不處理。`balance` 可以安全計入:`OverviewSummary` 只由分享者自己的原始資料算出、不含任何分享項目,所以互相分享結餘也不會遞迴或重複計算。

### RewardPlan(信用卡回饋試算方案)

```ts
{
  _id: ObjectId,
  user: ObjectId,
  name: string,                 // 方案名稱,例如「CUBE 玩數位」
  terms: [{                     // 各項相加;每一項 = 金額 × rate%,再依 rounding 取整
    rate: number,               // 回饋率(%),0 < rate <= 100
    rounding: "floor" | "round" // 取底 / 四捨五入
  }],
  colorIndex: number,           // 圖表顏色槽位 0-7,新增時取第一個沒被用到的,之後不變(顏色跟著方案,不跟排名)
  createdAt: Date,
  updatedAt: Date
}
```

> 純試算用,不接任何交易資料。每人最多 8 個方案(圖表只有 8 個驗證過的分類色)、每個方案最多 10 項。計算邏輯在 `lib/rewardPlan.ts` 的 `planReward()`(取整前補 1e-9,避免 `1000 × 2.3%` 這類浮點誤差算成 22)。

### RateLimit(頻率限制計數)

```ts
{
  _id: ObjectId,
  key: string,      // unique,例如 "mail:cooldown:<email>"、"mail:hour:<email>"、"mail:ip:<ip>"、"login:fail:<email>:<ip>"、"login:fail:<email>"
  count: number,
  expiresAt: Date   // TTL 索引(expireAfterSeconds: 0),過期由 MongoDB 自動刪除
}
```

> 跟帳號無關(要能限制 IP、也要能對還沒註冊的 email 計數),所以沒有 `user` 欄位。`hitRateLimit()` 用 update pipeline 原子地計數;TTL 刪除有最多約 1 分鐘延遲,所以讀取端一律自己再判斷 `expiresAt`。

### Notification(系統公告)

```ts
{
  _id: ObjectId,
  title: string,
  content: string,
  createdAt: Date,
  updatedAt: Date
}
```

> 全站共用同一份資料,沒有 `user` 欄位。只有 `ADMIN_EMAIL` 這個帳號能透過 `/admin/notification` 發布/編輯/刪除;每次發布新公告都會把所有 `User.notificationRead` 重置為 `false`,讓 Navbar 的通知鈴鐺顯示未讀提示。

## API Routes

除了 `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/verify-email`、`/api/auth/resend-code`、`/api/auth/forgot-password`、`/api/auth/reset-password` 以外,以下所有 API 都要求已登入(`requireAuth()`,未登入回傳 `401`),而且查詢/寫入一律加上 `user: auth.userId` 條件做資料隔離。標「Admin」的另外要求 `email === ADMIN_EMAIL`(否則回傳 `403`)。

### 認證 `/api/auth`

| Method / 路徑 | 說明 |
|---|---|
| `POST /api/auth/register` | `{ email, password }`,建立(或重用尚未啟用的既有)帳號並寄送 6 碼驗證碼,不限制帳號數量;寄信超過頻率限制回 429 |
| `POST /api/auth/login` | `{ email, password }`,帳密錯誤回 401;同 email + IP 連續錯 3 次後 10 分鐘內回 429;帳號未啟用回 `403 + needsVerification`;成功則簽發 JWT 存入 httpOnly cookie |
| `POST /api/auth/logout` | 清除目前這台的登入 cookie |
| `POST /api/auth/logout-all` | 登出所有裝置:`tokenVersion` +1 並清掉目前這台的 cookie,其他裝置最晚 30 分鐘內登出 |
| `GET /api/auth/me` | 回傳 `{ email, specialDate, isAdmin }` |
| `PATCH /api/auth/me` | `{ specialDate: number\|null }`,設定或清除月結算日(1-31) |
| `POST /api/auth/verify-email` | `{ email, code }`,驗證成功後 `emailVerified = true`;每組驗證碼最多試 5 次 |
| `POST /api/auth/resend-code` | `{ email }`,重新寄送註冊驗證碼(僅限尚未啟用的帳號);超過頻率限制回 429 |
| `POST /api/auth/forgot-password` | `{ email }`,寄送重設密碼驗證碼;帳號不存在或超過頻率限制也回傳成功(只是不寄) |
| `POST /api/auth/reset-password` | `{ email, code, newPassword }`,驗證碼正確就更新密碼,並視為完成 email 驗證;`tokenVersion` +1 登出所有裝置;每組驗證碼最多試 5 次 |
| `POST /api/auth/change-password` | `{ currentPassword, newPassword }`,需先驗證目前密碼;`tokenVersion` +1 讓其他裝置登出,目前這台換發新 token |
| `POST /api/auth/delete-account` | `{ password }`,驗證密碼後刪除帳號本身,以及該使用者名下所有 Card / Transaction / Utility / CustomItem / OverviewSummary / Share(owner) / RewardPlan 資料 |

### 信用卡 `/api/cards`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/cards` | 列出我的所有卡片 |
| `POST /api/cards` | `{ name, closingDate, paymentDate, isDebit }` 新增;`isDebit: true`(簽帳金融卡)時不需要也不存結帳日 / 繳款日 |
| `GET/PUT/DELETE /api/cards/[id]` | 讀取/更新/刪除單張卡片;PUT 忽略 `isDebit`,卡片類型不能改(簽帳金融卡只能改名稱) |

### 交易 `/api/transactions`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/transactions` | 支援 `?type=&billingPeriod=&category=&card=` 篩選;查 `category=credit_card` 時會一併帶出 `installment`(分期本質上也是刷卡)。**讀取前一律先呼叫 `generateDueSubscriptionTransactions()` 補生成到期的訂閱交易**,確保 `/income`、`/expense`、`/overview` 永遠看得到最新結果 |
| `POST /api/transactions` | 建立單筆交易(現金/信用卡單筆);信用卡單筆支出可帶 `pointsDiscount`(0 ~ amount,0/空值不存);自動用 `calculateBillingPeriod()` 算出 `billingPeriod` 並存入,同時觸發 `recomputeOverviewSummary` |
| `GET/PUT/DELETE /api/transactions/[id]` | 更新時沒帶 `pointsDiscount` 沿用原值,帶 `null`/0 或改成非信用卡單筆支出會移除該欄位;若新舊 `billingPeriod` 不同,新舊兩個月份的彙總都會重算;刪除若該筆有 `installmentGroupId`,會把同一組所有期數一起刪除並重算受影響的每個月份 |
| `POST /api/transactions/installment` | `{ item, date, card, totalAmount, totalNumber }`,一次生成整組分期交易,共用同一個 `installmentGroupId`;金額除不盡的餘數放在第一期,其餘各期平分 |

### 訂閱 `/api/subscriptions`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/subscriptions` | 列出我的所有訂閱 |
| `POST /api/subscriptions` | `{ item, kind?, amount, category, card?, startDate }`,建立後立刻呼叫惰性生成,補齊已到期的部分 |
| `PUT /api/subscriptions/[id]` | 只改訂閱設定本身(不動 `lastGeneratedDate`),已生成的交易不受影響,新設定只套用在之後新生成的期數 |
| `DELETE /api/subscriptions/[id]` | 只刪訂閱設定,停止之後繼續生成;已生成的交易是獨立紀錄,不會被連帶刪除 |

### 房租水電 `/api/utilities`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/utilities` | 支援 `?year=&month=` 篩選(`/overview` 不打這支,改由 `GET /api/overview` 一次取得;保留給需要單獨讀取的情境) |
| `POST /api/utilities` | 新增一筆 |
| `PUT /api/utilities` | 不帶 id,依 `{ year, month }` upsert,供 `/overview` inline edit 使用,前端一律送整份資料覆寫(不含 `paid`,所以編輯金額不會洗掉繳費狀態) |
| `PATCH /api/utilities` | `{ year, month, paid }`,只切換該月的繳費狀態;不影響金額所以不重算 `OverviewSummary`;該月還沒有資料回 404 |
| `GET/PUT/DELETE /api/utilities/[id]` | 讀取/更新/刪除單筆,更新若 `year`/`month` 改變,新舊月份的彙總都會重算 |

### 自訂項目 `/api/custom-items`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/custom-items` | 支援 `?year=&month=` 篩選(`/overview` 不打這支,改由 `GET /api/overview` 一次取得;保留給需要單獨讀取的情境) |
| `POST /api/custom-items` | `{ year, month, name, amount, date? }` 新增 |
| `PUT/DELETE /api/custom-items/[id]` | 更新/刪除;PUT 沒帶 `date` 沿用原值,帶 `null` / 空字串清除 |

### 信用卡對帳 `/api/card-reconciliations`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/card-reconciliations?period=` | 回傳 `{ statuses: { [cardId]: "reconciled" \| "paid" } }`,沒出現的卡就是未對帳(`/overview` 不打這支,改由 `GET /api/overview` 一次取得;保留給需要單獨讀取的情境) |
| `PUT /api/card-reconciliations` | `{ card, period, status }`,`status` 為 `"reconciled"` / `"paid"` 時建立或更新紀錄,`null` 刪除紀錄(回到未對帳) |

### 總覽整合 `/api/overview`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/overview?period=YYYY-MM` | `/overview` 專用,把**只有總覽頁會讀**的資料一次回傳:`{ utility, customItems, cardStatuses, incomingShares }`。各欄位內容與對應的獨立 API 相同:`utility` = `GET /api/utilities?year=&month=` 的那一筆(沒有則 `null`)、`customItems` = `GET /api/custom-items?year=&month=` 的 `items`、`cardStatuses` = `GET /api/card-reconciliations?period=` 的 `statuses`、`incomingShares` = `GET /api/shares/incoming?period=` 的 `items` |
| `GET /api/overview/year?year=YYYY` | `/overview` 年度檢視用:先補生成到期的訂閱交易,再一次查出該年 12 個月的 `OverviewSummary` 快取(沒有快取的月份才逐月走 `getOverviewSummary` 現場算並補上),回傳 `{ year, months: [{ period, income, expense, balance, cash, installment, subscription, utility, customItems, cards, sharedIncome, sharedExpense }], cards: [{ _id, name, isDebit }] }`;除了 `sharedIncome` / `sharedExpense` 都只含自己的收支。這兩個是該月別人分享給我、且**目前**勾選納入(`included`)的項目,收入與支出分開加總(同 `includedSharedTotals()`),分享者的快取一次查出整年,缺的才逐月現場算 |

> **哪些併、哪些不併**:`/overview` 每次載入只打 3 支 API——`/api/overview`、`/api/transactions?billingPeriod=`、`/api/cards`。交易和卡片在 `/income`、`/expense`、`/cards` 等其他頁面也會獨立呼叫,所以**不併進來**,維持各自的 API。上面四支被整合的 GET 仍然保留(行為不變),只是 `/overview` 不再使用;它們和 `/api/overview` 共用同一份查詢邏輯(`lib/getCardReconciliationStatuses.ts`、`lib/getIncomingShares.ts`),回傳的資料一定一致。新增、修改、刪除(POST / PUT / DELETE)一律還是打各自的 API。

### 分享 `/api/shares`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/shares` | 我(分享者)設定過的分享清單 |
| `POST /api/shares` | `{ targetEmail, itemKeys: string[] }`,把一個或多個項目分享給某個 email(不能分享給自己) |
| `PUT /api/shares` | `{ targetEmail, itemKeys: string[] }`,把我分享給某個 email 的項目整份設成 `itemKeys`:新的項目新增、不在清單裡的刪除、兩邊都有的不動(保留收件人原本的 `included`);空陣列等於取消分享給這個人的所有項目。供 `/overview` 共享明細裡「編輯項目」使用 |
| `PUT /api/shares/[id]` | `{ included }`,僅收件人(`targetEmail` 對得上自己 email)可呼叫,決定要不要把這筆分享納入自己的收支計算 |
| `DELETE /api/shares/[id]` | 僅分享者(`owner`)可呼叫,取消分享 |
| `GET /api/shares/incoming?period=` | 別人分享給我的項目,金額即時從各分享者當月的 `OverviewSummary` 讀出(沒快取才現場算並補上)(`/overview` 不打這支,改由 `GET /api/overview` 一次取得;保留給需要單獨讀取的情境) |

### 回饋試算 `/api/reward-plans`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/reward-plans` | 我的所有方案(`/cards` 頁面是 server component 直接查,不打這支) |
| `POST /api/reward-plans` | `{ name, terms: [{ rate, rounding }] }` 新增;超過 8 個回 400,`colorIndex` 由後端分配 |
| `PUT/DELETE /api/reward-plans/[id]` | 更新名稱與規則(不動 `colorIndex`)/ 刪除 |

### 系統通知 `/api/notifications`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/notifications` | 導覽列鈴鐺用,固定回傳最新 3 則公告,以及我是否已讀 |
| `POST /api/notifications/mark-read` | 把我的已讀狀態設為已讀 |
| `GET/POST /api/admin/notifications` **(Admin)** | 列出(預設 10 筆,`?limit=` 最多 100)/ 發布新公告(`{ title, content }`,發布後重置所有使用者已讀狀態) |
| `PUT/DELETE /api/admin/notifications/[id]` **(Admin)** | 編輯 / 刪除一則公告 |

### 使用者(後台)`/api/admin/users`

| Method / 路徑 | 說明 |
|---|---|
| `GET /api/admin/users` **(Admin)** | 分頁列出所有使用者(`createDate` 新到舊,每頁 20 筆):`?page=`(從 1 開始)、`?q=` 依 email 模糊搜尋;回傳 `{ users: [{ _id, email, createDate, emailVerified }], total, page, pageSize }` |

## 頁面結構

| 路徑 | 說明 |
|---|---|
| `/login` | 登入頁 |
| `/register` | 註冊頁,不限制帳號數量 |
| `/verify-email` | 輸入註冊 / 忘記密碼驗證碼,啟用帳號 |
| `/forgot-password` | 忘記密碼:寄送驗證碼 + 設定新密碼 |
| `/` | 未登入可見的介紹頁(用 `lib/demoData.ts` 的假資料展示功能,不接資料庫);已登入會直接 `redirect("/overview")` |
| `/income` | 收入總覽(列表 + 篩選) |
| `/expense` | 支出總覽(列表 + 篩選),含信用卡分期與信用卡對帳標記。右下角浮動「+」的新增視窗上方可切換「支出 / 訂閱」(`TransactionsClient` 的 `addAlternative`);篩選列右邊的「訂閱」按鈕(帶數量)打開所有訂閱清單(`components/SubscriptionsClient.tsx`):上方每月訂閱合計,各訂閱依下次扣款日排序,左邊是分類圖示,中間是名稱與「每月 D 號 · 付款方式」,右邊是金額與「下次 M/D(N 天後)」,點一筆打開編輯,刪除在編輯表單按鈕列最右邊;清單底部也有「新增訂閱」。訂閱清單由 `ExpenseClient` 持有,異動後重抓訂閱並讓交易列表重新讀取 |
| `/overview` | 主要整合頁面,詳見下方說明 |
| `/cards` | 信用卡管理(`components/CardForm.tsx`):「我的卡片」標題列右邊「+ 新增」開 dialog 新增;卡片以兩欄卡片列出(簽帳金融卡紫色圖示),點整張卡片開 dialog 編輯,刪除在 dialog 按鈕列最右邊。新增時可勾選「簽帳金融卡」,勾選後隱藏結帳日 / 繳款日;編輯時鎖住無法更改。下方是**回饋試算**(`components/RewardCalculator.tsx`):標題列「+ 新增」開 dialog 建立方案(名稱 + 幾項「回饋率 % + 取底 / 四捨五入」);輸入消費金額(預設 200)後,方案清單由高到低列出回饋額(顏色點 + 名稱,最高的標「最高」;規則不顯示在外面,點一列進編輯才看得到,也在那裡刪除),下面 Recharts 折線圖(`stepAfter`,取整造成的階梯才畫得出來)畫 0 ~ 該金額的 110% 各方案的回饋比較,輸入的金額位置有一條虛線參考線(標金額),tooltip 列出該金額各方案回饋 |
| `/settings` | 個人設定(`components/SettingsClient.tsx`):最上方顯示目前登入的帳號 email(來自 `GET /api/auth/me`),下面是分組的列表式選單,點每一列在 dialog 裡打開對應內容——月結算日(`specialDate`)、外觀(淺色 / 深色 / 跟隨系統,`ThemeSettings.tsx`)、加到手機主畫面教學(`AddToHomeScreenGuide.tsx`,純說明,不做 PWA)、修改密碼、刪除帳號;另有「管理員後台」連結(僅 `isAdmin`)、「登出」與「登出所有裝置」(確認後呼叫 `POST /api/auth/logout-all`) |
| `/admin`、`/admin/notification` | 僅 `ADMIN_EMAIL` 可進入,發布/編輯/刪除系統公告 |
| `/admin/users` | 僅 `ADMIN_EMAIL` 可進入。上方兩張統計卡(`components/AdminStatsSection.tsx`,資料由 server component 直接呼叫 `lib/getAdminStats.ts`):**近 30 天加入人數**(依 `User.createDate`)與**近 7 天新增交易數**(依 `Transaction.createdAt`,含訂閱自動生成與分期各期),一律以台灣時間切日;每張卡附每日新增數長條圖(x 軸 M/D,窗口內沒資料的日子補 0),以及跟昨天窗口比的升降 = 今天的數量 − 昨天窗口第一天(今天往前 30 / 7 天那天)的數量。下方是使用者清單(`components/AdminUsersClient.tsx`,打 `GET /api/admin/users` 分頁 + email 搜尋) |

> 導覽列(`components/Navbar.tsx`):左邊是 `components/Logo.tsx` 的 Subanote 品牌字(SVG,Pacifico 手寫體 + 品牌色漸層),中間是頁面選單(桌面版用 `grid-cols-[1fr_auto_1fr]` 讓選單真正置中),右邊是通知鈴鐺 / 設定 / 深淺色快速切換。手機版沒有漢堡選單:上方只留 Logo 與通知 / 深淺色,頁面選單與設定(收入 / 支出 / **總覽(正中間)** / 信用卡 / 設定(最右邊),各帶圖示)移到固定在底部的分頁列(`components/BottomNav.tsx`,`NAV_LINKS` 與 Navbar 共用),方便單手點;底部分頁列前有同高的佔位避免擋住內容,浮動「+」按鈕與 toast 在手機上也往上移到分頁列上方(`viewport` 設 `viewportFit: "cover"`,用 `env(safe-area-inset-bottom)` 避開 iPhone home bar)。管理員入口與登出不在導覽列,在 `/settings`。登入、註冊、驗證、忘記密碼頁與未登入首頁的標題也都用同一個 Logo。

> `/income`、`/expense` 共用 `components/TransactionsClient.tsx`:只依月份向 `GET /api/transactions` 抓當月全部資料,付款方式 / 信用卡篩選都在前端過濾(選「信用卡」一併包含分期,規則同 API;收入一律是現金,所以 `/income` 不顯示付款方式篩選)。方便其他頁面導過來時直接套用篩選,月份與篩選可以用網址 query 帶入初始值(只在進頁面時讀一次,之後操作不會回寫網址):`?period=YYYY-MM&category=cash|credit_card|installment&card=<cardId>&q=<關鍵字>`(不合法的值忽略;只帶 `card` 視為信用卡篩選;`/income` 只吃 `period`、`kind` 與 `q`),收入、支出都有分類篩選(`components/KindPicker.tsx` 的 `KindFilter`;`?kind=` 也可帶入),交易 / 訂閱表單選分類用同檔的 `KindPicker`(支出 8 個圖示格子,手機 4 欄、桌面一排;收入 4 個一排),每筆交易名稱前面顯示分類圖示(`components/KindIcon.tsx`,SVG + 各分類一個顏色的圓底);切換篩選不會重新打 API;新增交易是右下角的浮動「+」按鈕(樣式同 `/overview` 手機版的快速記帳,但桌面版也顯示,列表底部留白避免被擋住);列表上沒有編輯 / 刪除按鈕,點整筆交易(或鍵盤 Enter / 空白鍵)就打開編輯 dialog,刪除按鈕放在 dialog 按鈕列最右邊(`TransactionForm` 的 `onDelete`,仍會跳刪除確認;刪除成功後關閉 dialog);新增 / 編輯 / 刪除交易後也不重抓整個月份,直接用 API 回應更新本地列表(只保留 `billingPeriod` 是目前月份的交易,例如分期的其他期數、改日期跑到別的月份的會被拿掉;刪除分期依 `installmentGroupId` 把同組的其他期一起移除;新增時 API 回傳的 `card` 只是 id,由 `TransactionForm` 用手上的卡片清單補成完整卡片),只有訂閱新增/編輯/刪除(會補生成交易)才重新讀取;另有一列前端本地的名稱搜尋(可用半形/全形逗號或頓號分隔多個關鍵字,符合任一即顯示,總額跟著只算符合的項目),依日期或金額排序(旁邊共用一個方向箭頭切換高到低 / 低到高,再點一次目前已選的欄位也會反轉;日期相同時再依 `createdAt` 同方向排序,金額相同時依日期、`createdAt` 新到舊),以及列表 / 2 欄 / 3 欄的顯示方式切換(排序與顯示方式都記在 localStorage;手機版一律單欄,不顯示顯示方式切換)。

### `/overview` 頁面配置(由上到下)

1. **月份選擇器**:切換不同月份(對應 `billingPeriod` / Utility 的 year+month)。右邊是「月 / 年」切換鈕:切到「年」改顯示年度檢視(`components/YearOverview.tsx`,打 `GET /api/overview/year`,資料來自 `OverviewSummary` 快取),取代下面所有月度區塊與快速記帳按鈕——年份切換、統計月份區間(`components/MonthRangePicker.tsx`:按鈕(跟年份按鈕一樣是灰外框,全年或自訂區間只靠文字區分)點開 12 個月格子,第一下選起始月、第二下選結束月,另有「全年」重設;預設 1–12 月,選的區間只對當年有效,換年份回到 1–12 月;用來排除還沒開始記帳或這個月還沒記完的月份,以下所有數字、圖表、明細都只算區間內的月份,純前端過濾不重打 API)、年收入 / 年支出 / 年結餘 / 月平均支出(只除以有收支的月份)、每月收入 vs 支出長條圖(收入綠、支出紅;紅綠對色盲分辨度偏低,所以收入固定在每組左邊並搭配圖例與 tooltip 文字)、「明細表」按鈕(用 dialog 顯示每月收支結餘表與合計列,點月份切回月檢視)、各信用卡刷卡金額(標題右邊顯示所有卡合計;已刪除但當年有金額的卡顯示「已刪除的信用卡」),下面接支出分項(現金 / 分期 / 訂閱 / 房租水電 / 自訂項目 / 共享收入 / 支出),順序同月檢視。圖表標題列的共享圖示按鈕(只有 icon,放在圖例最右邊;計入時用淡靛藍色,避開圖表的收入綠 / 支出紅,分項格子的指示點也用同色)與分項裡的「共享收入 / 支出」格子是同一個開關,點任一個切換是否計入統計(預設計入,同月檢視):每個月的共享收入加進該月收入、共享支出加進該月支出,上方年度數字、長條圖、月份表都跟著變;點長條或明細表的某個月份會切回月檢視並跳到該月。檢視狀態不記憶,進頁面一律是月檢視;年檢視的年份是獨立 state,切年份不會觸發月度資料重新載入
2. **Overview 圖表**:用 Recharts 顯示該月份的收入 vs 支出圖表,呈現該月 `billingPeriod` 底下所有交易的收支狀況
   - **分類統計**(`components/CategoryBreakdown.tsx`,緊接在每日支出圖表下方):依交易分類加總本月收入 / 支出,每邊一個簡單圓環(中間是總額)+ 由多到少的橫條列表(分類圖示、名稱、比例條、金額、百分比),點一列導到 `/expense` 或 `/income` 並帶 `?period=&kind=`。手機和桌面都用右上角「支出 / 收入」切換(預設支出),一次只顯示一邊,圓環在桌面放大到 160px;兩邊疊在同一格(沒選的 `invisible` 仍佔位),高度一律取較高的那邊,切換時卡片不會伸縮。只統計交易(前端用已抓回的當月交易現場算),不含房租水電、自訂項目與共享項目
3. **每日可花預算**:若使用者在 `/settings` 設定了月結算日(`specialDate`),顯示距離下次結算日還有幾天,以及「本月結餘 ÷ 剩餘天數」算出的每日可花預算(`lib/calculateDailyBudget.ts`);沒設定則改顯示提示(`components/SpecialDatePrompt.tsx`),說明這個功能並可直接在此輸入日期設定(`PATCH /api/auth/me`),設定後立刻顯示預算;右上角叉叉可關閉提示,記在 localStorage 的 `special-date-prompt-dismissed`,之後在這個瀏覽器不再顯示(仍可到 `/settings` 設定)
4. **Row 1 — 房租電費**(`components/UtilityInlineEditor.tsx`):預覽壓成精簡的一列——標題列是本月合計、總開關、繳費標籤與編輯,底下一排四格帳單日 / 租金 / 電費 / 水費(電費水費的度數 × 單價說明放在 tooltip,沒計入統計的格子變淡加刪除線)。繳費標籤點一下在「未繳費 ↔ 已繳費」之間切換(`PATCH /api/utilities`,樂觀更新,顏色同信用卡的已繳費;手機只顯示圖示)。租金/電費/水費/總開關可個別開關是否計入統計,**點「編輯」可直接在此區塊內編輯並儲存**(inline edit,帳單日 / 租金 / 電費 / 水費各一個同格式的框);該月沒有資料時整塊收成單行:標題列右邊淡色「本月無資料」+「+ 新增」按鈕(淺色 / 深色模式都是白底,跟自訂項目的新增按鈕同樣式;點了直接進 inline 編輯)。儲存(含總開關)後直接用 `PUT /api/utilities` 回傳的資料更新本地狀態(`toUtilityDTO()` 補舊資料缺的欄位),不重新載入總覽;下方自訂項目(`components/CustomItemsEditor.tsx`,可填日期(幾號,選填),列表依日期排序、沒日期的排最後,日期顯示成「M/D」小標籤;標題列右邊的「+ 新增」按鈕另開 dialog 輸入名稱 / 金額 / 日期,新增成功後關閉;沒有項目時整塊收成單行:標題列右邊淡色「本月無資料」+「+ 新增」,有項目才展開列表並把提示換成合計)的新增 / 編輯 / 刪除、分享項目的「納入收支」儲存也一樣只更新本地狀態(分享納入只套用成功送出的變更)
5. **Row 2 — 收入 / 支出簡覽**:
   - 上方顯示該月 **Total**(收入總額、支出總額、結餘),以及現金/分期/訂閱/自訂項目/各張信用卡的分項總額
   - 「其他」區塊的分項:現金、房租水電、自訂項目、**分期**、**訂閱**(各一格)、**共享收入 / 支出**(別人分享給我且勾選納入的項目,收入與支出分開加總後用斜線分開顯示;點一下切換是否計入上方統計,開啟時分別加進收入與支出,規則見 `includedSharedTotals()`)
   - 信用卡區塊標題右側顯示所有卡片本月刷卡金額**合計**(含分期,等於下方各卡金額加總),點擊導到 `/expense?period=&category=credit_card`
   - 每張信用卡的狀態標籤點一下依序切換:未對帳 → 已對帳 → 已繳費 → 未對帳(`/api/card-reconciliations`);簽帳金融卡沒有帳單,不顯示對帳標籤,信用卡圖示塗成紫色區分;點卡片其他地方則導到 `/expense?period=&category=credit_card&card=<cardId>`,直接看這張卡當月的明細(含分期)
   - 底下分別列出該月 income / expense 的簡易預覽,點擊可導向 `/income` 或 `/expense` 查看完整列表
6. **分享項目**:顯示別人分享給我的項目(金額即時來自對方的月度彙總),可勾選是否納入自己的收支統計(虛擬項目,不會真的存成一筆交易;每個分享者一組,顯示已納入的收入 / 支出);也可以把自己的項目分享給其他 email;「我分享出去的項目」依 email 分組,每組可用「編輯項目」直接勾選增減分享給這個人的項目(`PUT /api/shares`),或逐項取消分享
7. **快速記帳浮動按鈕**(`components/QuickAddButton.tsx`,僅手機版 `sm:hidden`):右下角「+」按鈕,點開 dialog 切換收入/支出,直接沿用 `TransactionForm` 新增交易,新增後用 API 回應把歸屬目前月份的交易直接併進總覽的本地交易列表(總覽數字都是前端現場算的),不重新載入。信用卡清單直接用總覽已經抓回來的 `/api/cards`(不再另外打 API);總覽還沒載入完時先用 localStorage 的 `cards-cache`(`lib/cardsCache.ts`)顯示表單,最新清單回來後覆蓋並更新快取(內容沒變不寫入)。登入 / 登出 / 刪除帳號時清掉快取,避免顯示上一個帳號的卡片

> 日期 / 月份選擇:全站不用原生 `<input type="date|month">`。`components/MonthPicker.tsx`(左右箭頭切月 + 中間「YYYY 年 M 月」點開年份切換與 12 個月格子,底部「本月」)、`components/DatePicker.tsx`(按鈕顯示「YYYY/MM/DD(週)」,今天會多一個「今天」標籤;點開月曆面板,今天有外框、選中實心,底部「昨天 / 今天」;交易表單用 `showDayShift` 在兩側加前一天 / 後一天箭頭)。彈出面板點外面 / 按 Esc 關閉的邏輯共用 `lib/useDismiss.ts`(`Dropdown` 也用它)。

> 下拉選單:全站不用原生 `<select>`,一律用 `components/Dropdown.tsx`(選項可帶圖示、支援鍵盤 ↑↓ / Enter / Esc、點外面關閉;表單裡用 `fullWidth`)。付款方式 / 信用卡 / 「全部」的選項與圖示集中在 `components/dropdownOptions.tsx`(簽帳金融卡用紫色圖示,同 `/overview`);因為沒有原生 `required`,表單送出前自己檢查有沒有選信用卡。

> 房租水電區塊的電費/水費用 `components/RoundedAmount.tsx` 顯示:預設顯示四捨五入後的整數(也就是實際計入統計的金額),若實際金額有小數,點一下可切換顯示實際金額。

## 深色 / 淺色模式(Dark / Light Mode)

- 三種偏好:淺色 / 深色 / 跟隨系統,在 `/settings` 的「外觀」設定;Navbar 的太陽/月亮按鈕是快速切換,直接切成跟目前相反的淺色或深色(會離開跟隨系統)
- 偏好存在 localStorage 的 `theme`(`"light"` / `"dark"`;跟隨系統 = 不存這個 key),讀寫邏輯集中在 `lib/theme.ts`
- 實際套用是切換 `<html>` 的 `.dark` class(Tailwind v4:`globals.css` 的 `@custom-variant dark (&:where(.dark, .dark *))`),`.dark` 同時設定 `color-scheme: dark`,讓捲軸等瀏覽器原生元件也跟著變深色。`app/layout.tsx` 的 `THEME_INIT_SCRIPT` 在頁面渲染前先套用,避免閃爍;跟隨系統時也會監聽 `prefers-color-scheme` 變化即時切換

## RWD(響應式設計)

- **不做 PWA**,純粹是網頁響應式設計,確保手機瀏覽器開啟也能正常操作(記帳情境常常會用手機隨手記錄)
- 使用 Tailwind 的響應式 class(`sm: md: lg:`)確保手機/平板/桌面都能正常顯示
- `/overview` 的圖表、row 區塊在手機上應改為單欄堆疊排版

## 專案結構(現況)

```
/app
  layout.tsx
  page.tsx                        // 未登入介紹頁(demo 資料)
  manifest.ts                     // Web App Manifest(非 PWA,只是提供 icon/主題色 metadata)
  /login, /register, /verify-email, /forgot-password  // 各自 page.tsx
  /income, /expense, /overview, /cards, /settings      // 各自 page.tsx
  /admin
    layout.tsx                    // 檢查 ADMIN_EMAIL,非管理員導回 /overview
    page.tsx
    /notification/page.tsx
    /users/page.tsx
  /api
    /auth/{register,login,logout,logout-all,me,verify-email,resend-code,forgot-password,reset-password,change-password,delete-account}/route.ts
    /cards/route.ts, /cards/[id]/route.ts
    /transactions/route.ts, /transactions/[id]/route.ts, /transactions/installment/route.ts
    /subscriptions/route.ts, /subscriptions/[id]/route.ts
    /utilities/route.ts, /utilities/[id]/route.ts
    /custom-items/route.ts, /custom-items/[id]/route.ts
    /card-reconciliations/route.ts
    /overview/route.ts              // /overview 專用整合 API
    /overview/year/route.ts         // /overview 年度檢視(讀 OverviewSummary 快取)
    /shares/route.ts, /shares/[id]/route.ts, /shares/incoming/route.ts
    /notifications/route.ts, /notifications/mark-read/route.ts
    /reward-plans/route.ts, /reward-plans/[id]/route.ts
    /admin/notifications/route.ts, /admin/notifications/[id]/route.ts, /admin/users/route.ts
/lib
  mongodb.ts                      // 資料庫連線
  auth.ts                         // 密碼雜湊、JWT 簽發/驗證、requireAuth()、ADMIN_EMAIL
  calculateBillingPeriod.ts       // 歸屬月份計算邏輯
  calculateMeterCost.ts           // 電費/水費金額計算
  calculateDailyBudget.ts         // 月結算日倒數 + 每日可花預算
  generateSubscriptionTransactions.ts // 訂閱惰性生成交易
  summarizeMonth.ts               // 月度彙總純函式(前後端共用)
  computeMonthSummary.ts          // 後端:查原始資料 + summarizeMonth
  getOverviewSummary.ts           // 讀 OverviewSummary 快取,沒有就現場算並補上
  recomputeOverviewSummary.ts     // 重算並覆寫 OverviewSummary 快取(供分享使用)
  getCardReconciliationStatuses.ts, getIncomingShares.ts // 獨立 API 與 /api/overview 共用的查詢
  overviewItems.ts                // 可分享項目 key/label 對照、已納入分享項目的收入 / 支出加總(includedSharedTotals)
  useIsDark.ts                    // 圖表用:目前是否深色模式
  otp.ts, email.ts                // 驗證碼產生、Resend 寄信
  theme.ts                        // 主題偏好(淺色/深色/跟隨系統)讀寫
  getAdminStats.ts                // 後台:近 30 天加入人數 / 近 7 天新增交易的每日統計與升降
  rewardPlan.ts                   // 回饋試算:計算、規則驗證、方案顏色
  security.ts, rateLimit.ts       // 驗證碼次數、寄信頻率、登入鎖定的限制與邏輯;頻率限制計數(RateLimit)
  expenseKind.ts, incomeKind.ts, transactionKind.ts // 交易分類(支出 / 收入兩組 + 共用邏輯)
  customItemDate.ts               // 自訂項目日期(DD)驗證
  useDismiss.ts                   // 彈出面板點外面 / Esc 關閉
  cardsCache.ts                   // 快速記帳用的信用卡清單 localStorage 快取
  addMonths.ts, period.ts, usePeriod.ts, demoData.ts
  models/
    User.ts, Card.ts, Transaction.ts, Subscription.ts, Utility.ts,
    CustomItem.ts, CardReconciliation.ts, OverviewSummary.ts, Share.ts, Notification.ts, RewardPlan.ts, RateLimit.ts
/components
  Navbar.tsx, ThemeToggle.tsx, MonthPicker.tsx, OverviewChart.tsx, OverviewClient.tsx
  TransactionForm.tsx, TransactionsClient.tsx, ExpenseClient.tsx
  CardForm.tsx, UtilityInlineEditor.tsx, CustomItemsEditor.tsx
  SubscriptionForm.tsx, SubscriptionsClient.tsx
  RewardCalculator.tsx, CategoryBreakdown.tsx, KindIcon.tsx, KindPicker.tsx, Dropdown.tsx, dropdownOptions.tsx, DatePicker.tsx, BottomNav.tsx,
  SpecialDatePrompt.tsx, YearOverview.tsx, MonthRangePicker.tsx
  ShareForm.tsx, SharedItemsSection.tsx, QuickAddButton.tsx, RoundedAmount.tsx, AddToHomeScreenGuide.tsx
  NotificationBell.tsx, AdminNotificationClient.tsx, AdminStatsSection.tsx, AdminUsersClient.tsx, Logo.tsx, ThemeSettings.tsx
  SettingsClient.tsx, SpecialDateForm.tsx, ChangePasswordForm.tsx, DeleteAccountForm.tsx
  ForgotPasswordForm.tsx, VerifyEmailForm.tsx
  Modal.tsx, ConfirmDialog.tsx, ToastProvider.tsx, RouteChangeToast.tsx, icons.tsx
proxy.ts                          // 取代 middleware.ts:未登入導回 /login + sliding session
```