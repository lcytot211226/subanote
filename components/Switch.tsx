"use client";

/** 開關(role="switch"),可帶左側文字標籤;房租水電總開關、共享設定的「納入收支」共用。 */
export default function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      {label && <span className="whitespace-nowrap text-zinc-600 dark:text-zinc-300">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed ${
          checked ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
