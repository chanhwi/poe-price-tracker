import { createContext, useContext, useEffect, useState } from "react";
import type { CurrencyMap } from "../lib/static";

/** Currency icon/name map, provided by App from data/static. */
export const CurrencyContext = createContext<CurrencyMap>({});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Props {
  amount: number;
  currency: string;
}

/** Render a price as amount + currency icon, with the localized currency name
 * on hover (title/alt). Falls back to the currency code text when no icon is
 * known OR when the icon image fails to load (broken CDN link / offline). */
export default function CurrencyAmount({ amount, currency }: Props) {
  const map = useContext(CurrencyContext);
  const c = map[currency];
  const [errored, setErrored] = useState(false);
  // Reset the load-error flag whenever the icon URL changes (instance reuse).
  useEffect(() => setErrored(false), [c?.image]);

  const showIcon = !!c?.image && !errored;
  return (
    <span className="cur" title={c?.text ?? currency}>
      {round(amount)}
      {showIcon ? (
        <img className="cur-icon" src={c.image} alt={c.text} onError={() => setErrored(true)} />
      ) : (
        <span className="cur-code">{currency}</span>
      )}
    </span>
  );
}
