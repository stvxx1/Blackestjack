import { useId } from 'react';

interface SegmentedProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

/** Radio group styled as a segmented control; arrow keys move between options natively. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className="inline-flex rounded-xl bg-black/25 p-1 ring-1 ring-white/10">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`relative cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brass-300 ${
            o.value === value ? 'bg-brass-400 text-felt-950' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => {
              onChange(o.value);
            }}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
