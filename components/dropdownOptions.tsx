import type { CardDTO } from "./CardForm";
import { IconBadge, type DropdownOption } from "./Dropdown";
import { BanknotesIcon, CalendarDaysIcon, CreditCardIcon, ListIcon } from "./icons";

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
    icon: (
      <IconBadge tone={card.isDebit ? "violet" : "neutral"}>
        <CreditCardIcon />
      </IconBadge>
    ),
  }));
}
