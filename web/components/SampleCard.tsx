import type { SampleReport } from "../lib/cases";
import { riskLabel, riskTone, usd } from "../lib/format";

export function SampleCard({ sample, featured = false }: { sample: SampleReport; featured?: boolean }) {
  const tone = riskTone(sample.risk);
  const fairWidth = Math.max(8, Math.min(100, Math.round((sample.fairHigh / sample.quoted) * 100)));

  return (
    <article className={featured ? "sample sample-featured" : "sample"}>
      <p className="sample-kicker">Sample report · Educational fixture</p>
      <h3>{sample.trade}</h3>
      <p className="scope">{sample.scope}</p>
      <p className="location">{sample.location}</p>
      <div className="compare">
        <div className="compare-row">
          <span>Quoted total</span>
          <strong>{usd(sample.quoted)}</strong>
        </div>
        <div className="bar bar-quoted" aria-hidden="true" />
        <div className="compare-row">
          <span>Fair range</span>
          <strong>
            {usd(sample.fairLow)}–{usd(sample.fairHigh)}
          </strong>
        </div>
        <div className="bar bar-fair" style={{ width: `${fairWidth}%` }} aria-hidden="true" />
      </div>
      <p className="savings">
        <span>Sample savings</span>
        <strong>{usd(sample.savings)}</strong>
      </p>
      <div className={`risk risk-${tone}`}>
        <div className="risk-row">
          <span>
            {sample.risk}
            <span className="risk-denom">/100</span>
          </span>
          <span>{riskLabel(sample.risk)}</span>
        </div>
        <div className="risk-track" aria-hidden="true">
          <span style={{ width: `${sample.risk}%` }} />
        </div>
      </div>
      <p className="fixture-id">Fixture {sample.id}</p>
    </article>
  );
}
