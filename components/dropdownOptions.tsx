import type { CardDTO } from "./CardForm";
import { IconBadge, type DropdownOption } from "./Dropdown";
import { BanknotesIcon, CalendarDaysIcon, CreditCardIcon, ListIcon } from "./icons";
import { PixelIcon } from "./CardIcon";

/** 下拉選單共用的選項:付款方式、信用卡,圖示跟 /overview 一致(簽帳金融卡用紫色)。 */

export const ALL_ICON = (
  <IconBadge>
    <ListIcon />
  </IconBadge>
);

const PAYMENT_ICON = {
  cash: (
    <IconBadge>
      <BanknotesIcon />
    </IconBadge>
  ),
  credit_card: (
    <IconBadge>
      <CreditCardIcon />
    </IconBadge>
  ),
  installment: (
    <IconBadge>
      <CalendarDaysIcon />
    </IconBadge>
  ),
};

export function paymentOption<T extends keyof typeof PAYMENT_ICON>(value: T, label: string): DropdownOption<T> {
  return { value, label, icon: PAYMENT_ICON[value] };
}

export function cardOptions(cards: CardDTO[]): DropdownOption<string>[] {
  return cards.map((card) => ({
    value: card._id,
    label: card.name,
    // 有自訂像素圖示就直接畫(不套圓底),大小跟圓底圖示一樣
    icon: card.pattern ? (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <PixelIcon pattern={card.pattern} className="h-5 w-5" />
      </span>
    ) : (
      <IconBadge tone={card.isDebit ? "violet" : "neutral"}>
        <CreditCardIcon />
      </IconBadge>
    ),
  }));
}
