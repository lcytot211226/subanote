import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChartBarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="12" width="3.5" height="8" rx="1" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
      <rect x="17.5" y="3" width="3.5" height="17" rx="1" />
    </svg>
  );
}

export function ArrowUpCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" />
    </Svg>
  );
}

export function ArrowDownCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8.5 12.5 12 16l3.5-3.5" />
    </Svg>
  );
}

export function ScaleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="17" y2="14" />
    </Svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Svg>
  );
}

export function BanknotesIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function CreditCardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </Svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12 12 3h6a3 3 0 0 1 3 3v6l-9 9-9-9Z" />
      <circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CalendarDaysIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Svg>
  );
}

export function ArrowPathIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12a8 8 0 0 1 14-5.3" />
      <path d="M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 3.7v3h-3" />
      <path d="M6 20.3v-3h3" />
    </Svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3 10.5 15 16 9.3" strokeWidth={2} />
    </Svg>
  );
}

export function UserGroupIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M14.7 13.2a4.6 4.6 0 0 1 5.8 4.4" />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 8.5a6 6 0 1 1 12 0c0 3.3 1 5.3 1.6 6.2.35.5-.02 1.3-.63 1.3H5.03c-.6 0-.98-.8-.63-1.3C5 13.8 6 11.8 6 8.5Z" />
      <path d="M9.5 18.3a2.5 2.5 0 0 0 5 0" />
    </Svg>
  );
}

export function QuestionMarkCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.6 2.25c-.8.4-1.1.95-1.1 1.75" strokeWidth={2} />
      <path d="M12 16.7h.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

export function Columns2Icon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="4.5" width="7" height="15" rx="1.5" />
      <rect x="13.5" y="4.5" width="7" height="15" rx="1.5" />
    </Svg>
  );
}

export function Columns3Icon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2.5" y="4.5" width="5" height="15" rx="1.25" />
      <rect x="9.5" y="4.5" width="5" height="15" rx="1.25" />
      <rect x="16.5" y="4.5" width="5" height="15" rx="1.25" />
    </Svg>
  );
}

export function ArrowDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function LockClosedIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </Svg>
  );
}

export function UserCircleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </Svg>
  );
}

export function DevicePhoneMobileIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </Svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </Svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15.75 19.5 8.25 12l7.5-7.5" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </Svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </Svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </Svg>
  );
}

export function ComputerDesktopIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </Svg>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </Svg>
  );
}

export function ArrowRightStartOnRectangleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </Svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
    </Svg>
  );
}

export function WaterDropIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5c3 3.6 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.9 6-10.5Z" />
    </Svg>
  );
}

// ---- 支出分類(lib/expenseKind.ts)----

export function FoodIcon({ className }: IconProps) {
  // 碗 + 筷子
  return (
    <Svg className={className}>
      <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z" />
      <path d="M9 20h6" />
      <path d="m13 8.5 6.5-5" />
      <path d="m10 8.5 6-6" />
    </Svg>
  );
}

export function GamepadIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.5l-.9 4a2.5 2.5 0 0 1-4.3 1.1L14 16h-4l-1.7 1.6A2.5 2.5 0 0 1 4 16.5l-.9-4A4.5 4.5 0 0 1 7.5 7Z" />
      <path d="M8 10v3M6.5 11.5h3" />
      <path d="M15.5 10.5h.01M17 12.5h.01" />
    </Svg>
  );
}

export function ShoppingBagIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </Svg>
  );
}

export function CarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 11.5 6.8 6.6A1.5 1.5 0 0 1 8.2 5.5h7.6a1.5 1.5 0 0 1 1.4 1.1L19 11.5" />
      <path d="M4 11.5h16a1 1 0 0 1 1 1V17H3v-4.5a1 1 0 0 1 1-1Z" />
      <path d="M5.5 17v2M18.5 17v2" />
      <path d="M7 14.25h.01M17 14.25h.01" />
    </Svg>
  );
}

export function MedicalIcon({ className }: IconProps) {
  // 圓角方框 + 十字
  return (
    <Svg className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 6.5C10.3 5.2 8 4.5 4 4.5v13c4 0 6.3.7 8 2 1.7-1.3 4-2 8-2v-13c-4 0-6.3.7-8 2Z" />
      <path d="M12 6.5v13" />
    </Svg>
  );
}

export function SportIcon({ className }: IconProps) {
  // 啞鈴
  return (
    <Svg className={className}>
      <path d="M8 12h8" />
      <rect x="5" y="7" width="3" height="10" rx="1" />
      <rect x="16" y="7" width="3" height="10" rx="1" />
      <path d="M2.5 10v4M21.5 10v4" />
    </Svg>
  );
}

export function EllipsisIcon({ className }: IconProps) {
  // 「其他」:2×2 小方格,比三個點明顯
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  );
}

// ---- 收入分類(lib/incomeKind.ts)----

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3.5 12.5h17" />
    </Svg>
  );
}

export function GiftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v7h14v-7" />
      <path d="M12 8.5v11" />
      <path d="M12 8.5c-1.5-3.5-5-4-5-1.75S9.5 8.5 12 8.5c2.5 0 5 .5 5-1.75S13.5 5 12 8.5Z" />
    </Svg>
  );
}

export function ArrowsRightLeftIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8h15.5M16 4.5 19.5 8 16 11.5" />
      <path d="M20 16H4.5M8 12.5 4.5 16 8 19.5" />
    </Svg>
  );
}

export function Cog6ToothIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </Svg>
  );
}
