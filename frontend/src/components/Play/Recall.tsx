import React, { useMemo, useState } from "react";
import type { GameAnswer, GameState } from "../../types/play";
import type { Submission } from "../../services/playService";
import type { MyAnswer } from "./Answering";
import { AnswerPicture } from "./PlayCommon";
import { nameOf, tileColour } from "../../utils/play";

/*
 * The types that test what you know without giving you the options to pick
 * from: type it, put it in order, estimate it, match the pairs. Answering on
 * the phone, and what the reveal shows for each.
 */

interface AnswerProps {
  game: GameState;
  mine: MyAnswer;
  submit: (a: Submission) => Promise<boolean>;
  remember: (patch: MyAnswer) => void;
}

// ─── type it ────────────────────────────────────────────────────────

export const Typed: React.FC<AnswerProps> = ({ mine, submit, remember }) => {
  const [text, setText] = useState(mine.text ?? "");
  const [editing, setEditing] = useState(!mine.text);
  const send = async () => {
    const clean = text.trim();
    if (!clean) return;
    if (await submit({ text: clean })) {
      remember({ text: clean });
      setEditing(false);
    }
  };
  if (!editing && mine.text) {
    return (
      <div className="jqzz-written-sent">
        <span className="jqzz-annot">you typed</span>
        <p className="jqzz-typed-sent">{mine.text}</p>
        <button className="jqzz-play-btn" onClick={() => setEditing(true)}>
          change it
        </button>
      </div>
    );
  }
  return (
    <form
      className="jqzz-typed"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        className="jqzz-play-input big"
        value={text}
        maxLength={200}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="type the answer"
        onChange={(e) => setText(e.target.value)}
      />
      <button className="jqzz-play-btn primary" disabled={!text.trim()}>
        send
      </button>
      <p className="jqzz-play-note">case, accents and one slip in a longer word don't count against you</p>
    </form>
  );
};

// ─── put in order ───────────────────────────────────────────────────

/** Tap the items in order: first, second, third. Tap a placed one to take it back. */
export const Order: React.FC<AnswerProps & { me: string }> = ({ game, mine, submit, remember }) => {
  const q = game.question!;
  const [placed, setPlaced] = useState<number[]>(mine.picks ?? []);
  const all = q.answers.length;
  const sent = mine.picks ?? [];
  const same = sent.length === placed.length && sent.every((id, i) => placed[i] === id);

  const tap = async (id: number) => {
    const next = placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id];
    setPlaced(next);
    // the order goes in as soon as it's whole; a change sends it again
    if (next.length === all && (await submit({ picks: next }))) remember({ picks: next });
  };

  return (
    <div className="jqzz-order">
      <p className="jqzz-play-note">
        {placed.length < all ? `tap them in order: ${ordinal(placed.length + 1)} next` : same ? "locked in. tap one to change it." : "sending..."}
      </p>
      <ol className="jqzz-order-placed" aria-label="your order">
        {placed.map((id, i) => {
          const a = q.answers.find((x) => x.id === id);
          if (!a) return null;
          return (
            <li key={id}>
              <button className="jqzz-order-item placed" onClick={() => tap(id)} style={{ "--tile": tileColour(i) } as React.CSSProperties}>
                <span className="jqzz-order-n">{i + 1}</span>
                <AnswerPicture src={a.imageUrl} game={game} />
                <span>{a.text || "..."}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="jqzz-order-pool">
        {q.answers
          .filter((a) => !placed.includes(a.id))
          .map((a) => (
            <button key={a.id} className="jqzz-order-item" onClick={() => tap(a.id)}>
              <AnswerPicture src={a.imageUrl} game={game} />
              <span>{a.text || "..."}</span>
            </button>
          ))}
      </div>
    </div>
  );
};

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

// ─── estimate ───────────────────────────────────────────────────────

const plain = (x: number) => (Number.isInteger(x) ? x.toLocaleString() : x.toLocaleString(undefined, { maximumFractionDigits: 3 }));

export const Estimate: React.FC<AnswerProps> = ({ game, mine, submit, remember }) => {
  const q = game.question!;
  const slider = q.min != null && q.max != null && q.max > q.min;
  const start = mine.text ?? (slider ? String(Math.round((q.min! + q.max!) / 2)) : "");
  const [value, setValue] = useState(start);
  const n = Number(value.replace(",", "."));
  const ok = value.trim() !== "" && Number.isFinite(n) && (q.min == null || n >= q.min) && (q.max == null || n <= q.max);
  const step = slider ? niceStep(q.max! - q.min!) : 1;
  const send = async () => {
    if (!ok) return;
    if (await submit({ text: value.trim() })) remember({ text: value.trim() });
  };
  return (
    <form
      className="jqzz-estimate"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="jqzz-estimate-read">
        <input
          className="jqzz-estimate-input OEF"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="your guess"
        />
        {q.unit && <span className="jqzz-estimate-unit">{q.unit}</span>}
      </div>
      {slider && (
        <input
          type="range"
          className="jqzz-estimate-slider"
          min={q.min!}
          max={q.max!}
          step={step}
          value={Number.isFinite(n) ? n : q.min!}
          onChange={(e) => setValue(e.target.value)}
          aria-label="slide to your guess"
        />
      )}
      {slider && (
        <div className="jqzz-estimate-ends jqzz-annot">
          <span>{plain(q.min!)}</span>
          <span>{plain(q.max!)}</span>
        </div>
      )}
      <button className="jqzz-play-btn primary" disabled={!ok || mine.text === value.trim()}>
        {mine.text && mine.text === value.trim() ? "locked in" : "lock in"}
      </button>
      {!ok && value.trim() !== "" && (
        <p className="jqzz-play-note">
          a number{q.min != null ? ` from ${plain(q.min)}` : ""}
          {q.max != null ? ` to ${plain(q.max)}` : ""}
        </p>
      )}
    </form>
  );
};

/** a slider step that lands on round numbers: 1, 5, 10, 50... */
function niceStep(span: number) {
  const raw = span / 200;
  if (raw <= 1) return span <= 20 ? 0.1 : 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 2 ? 1 : m < 5 ? 2 : 5) * p;
}

// ─── match pairs ────────────────────────────────────────────────────

/** Tap one on the left, then its other half on the right. Tap a pair again to undo it. */
export const Pairs: React.FC<AnswerProps> = ({ game, mine, submit, remember }) => {
  const q = game.question!;
  const halves = q.halves ?? [];
  const [pairs, setPairs] = useState<Record<number, string>>(mine.pairs ?? {});
  const [left, setLeft] = useState<number | null>(null);
  const colourOf = useMemo(() => {
    const m = new Map<number, number>();
    q.answers.forEach((a, i) => m.set(a.id, i));
    return (id: number) => tileColour(m.get(id) ?? 0);
  }, [q.answers]);
  const ownerOf = (key: string) => Number(Object.keys(pairs).find((id) => pairs[Number(id)] === key)) || null;

  const save = async (next: Record<number, string>) => {
    setPairs(next);
    if (Object.keys(next).length && (await submit({ pairs: next }))) remember({ pairs: next });
  };

  const tapLeft = (id: number) => {
    if (pairs[id]) {
      const next = { ...pairs };
      delete next[id];
      save(next);
      setLeft(null);
      return;
    }
    setLeft(left === id ? null : id);
  };

  const tapRight = (key: string) => {
    const owner = ownerOf(key);
    if (owner !== null && left === null) {
      const next = { ...pairs };
      delete next[owner];
      save(next);
      return;
    }
    if (left === null) return;
    const next = { ...pairs };
    if (owner !== null) delete next[owner];
    next[left] = key;
    setLeft(null);
    save(next);
  };

  const done = Object.keys(pairs).length;
  return (
    <div className="jqzz-pairs">
      <p className="jqzz-play-note">
        {left !== null ? "now its other half" : done < q.answers.length ? "tap one on the left, then its match" : "all paired. saved as you go."}
      </p>
      <div className="jqzz-pairs-cols">
        <div className="jqzz-pairs-col">
          {q.answers.map((a) => (
            <button
              key={a.id}
              className={`jqzz-pair${pairs[a.id] ? " paired" : ""}${left === a.id ? " picking" : ""}`}
              style={{ "--tile": colourOf(a.id) } as React.CSSProperties}
              onClick={() => tapLeft(a.id)}
              aria-pressed={left === a.id}
            >
              <AnswerPicture src={a.imageUrl} game={game} />
              <span>{a.text || "..."}</span>
            </button>
          ))}
        </div>
        <div className="jqzz-pairs-col">
          {halves.map((h) => {
            const owner = ownerOf(h.key);
            return (
              <button
                key={h.key}
                className={`jqzz-pair right${owner !== null ? " paired" : ""}`}
                style={owner !== null ? ({ "--tile": colourOf(owner) } as React.CSSProperties) : undefined}
                onClick={() => tapRight(h.key)}
                disabled={left === null && owner === null}
              >
                <span>{h.text || "..."}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── reveals ────────────────────────────────────────────────────────

export const TypedReveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question!;
  const typed = game.reveal?.typed ?? [];
  const accepted = q.answers.filter((a) => (a.value ?? 0) > 0);
  return (
    <div className="jqzz-typed-reveal">
      <div className="jqzz-typed-accepted">
        <span className="jqzz-annot">{accepted.length > 1 ? "accepted" : "the answer"}</span>
        {accepted.map((a) => (
          <span key={a.id} className="jqzz-typed-answer OEF">
            {a.text}
          </span>
        ))}
      </div>
      {typed.length > 0 ? (
        <ul className="jqzz-typed-list">
          {typed.map((t) => (
            <li key={t.text} className={t.right ? "right" : "wrong"}>
              <span>{t.text}</span>
              <span className="jqzz-annot">×{t.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="jqzz-play-note">nobody typed anything.</p>
      )}
      {mine?.text && <p className="jqzz-play-note">you typed “{mine.text}”</p>}
    </div>
  );
};

export const OrderReveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question!;
  const r = game.reveal!;
  const byId = new Map(q.answers.map((a) => [a.id, a]));
  const order = (r.order ?? []).map((id) => byId.get(id)).filter(Boolean) as GameAnswer[];
  const players = Math.max(1, game.players.length);
  return (
    <ol className="jqzz-order-reveal">
      {order.map((a, i) => {
        const right = r.placedRight?.[a.id] ?? 0;
        const mineRight = mine?.picks?.[i] === a.id;
        return (
          <li
            key={a.id}
            className={mine?.picks ? (mineRight ? "right" : "wrong") : undefined}
            style={{ "--share": right / players, "--i": i } as React.CSSProperties}
          >
            <span className="jqzz-order-n">{i + 1}</span>
            <AnswerPicture src={a.imageUrl} game={game} />
            <span className="jqzz-order-text">{a.text}</span>
            <span className="jqzz-annot">{right} got it</span>
          </li>
        );
      })}
    </ol>
  );
};

export const MatchReveal: React.FC<{ game: GameState; mine?: MyAnswer }> = ({ game, mine }) => {
  const q = game.question!;
  const r = game.reveal!;
  const halfText = (key?: string) => q.halves?.find((h) => h.key === key)?.text;
  return (
    <ul className="jqzz-match-reveal">
      {q.answers.map((a, i) => {
        const yours = halfText(mine?.pairs?.[a.id]);
        const right = yours != null && yours.trim().toLowerCase() === (a.match ?? "").trim().toLowerCase();
        return (
          <li key={a.id} className={yours != null ? (right ? "right" : "wrong") : undefined} style={{ "--i": i } as React.CSSProperties}>
            <span className="jqzz-match-l">{a.text}</span>
            <span className="jqzz-match-link" aria-hidden="true" />
            <span className="jqzz-match-r">{a.match}</span>
            <span className="jqzz-annot">
              {r.pairedRight?.[a.id] ?? 0} got it{yours != null && !right ? ` · you said ${yours}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/** Everyone's guess on a line, with the right number marked. */
export const NumberReveal: React.FC<{ game: GameState; me?: string }> = ({ game, me }) => {
  const q = game.question!;
  const r = game.reveal!;
  const guesses = Object.entries(r.numbers ?? {});
  const right = r.right ?? null;
  const values = guesses.map(([, v]) => v).concat(right != null ? [right] : []);
  let lo = q.min ?? Math.min(...values);
  let hi = q.max ?? Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return <p className="jqzz-play-note">nobody guessed.</p>;
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const closest = new Set(r.closest ?? []);
  const unit = q.unit ? ` ${q.unit}` : "";
  return (
    <div className="jqzz-number-reveal">
      {right != null && (
        <p className="jqzz-number-right OEF">
          {r.average && <span className="jqzz-annot">the room's average</span>}
          {plain(Math.round(right * 100) / 100)}
          <small>{unit}</small>
        </p>
      )}
      <div className="jqzz-number-line">
        <span className="jqzz-number-axis" />
        {right != null && <span className="jqzz-number-mark right" style={{ left: at(right) }} aria-hidden="true" />}
        {guesses.map(([id, v], i) => (
          <span
            key={id}
            className={`jqzz-number-mark${closest.has(id) ? " closest" : ""}${id === me ? " me" : ""}`}
            style={{ left: at(v), "--i": i } as React.CSSProperties}
            title={`${nameOf(game, id)}: ${plain(v)}${unit}`}
          />
        ))}
        <span className="jqzz-number-end jqzz-annot" style={{ left: 0 }}>
          {plain(lo)}
        </span>
        <span className="jqzz-number-end jqzz-annot" style={{ right: 0 }}>
          {plain(hi)}
        </span>
      </div>
      <ul className="jqzz-number-list">
        {guesses
          .sort((a, b) => (right == null ? 0 : Math.abs(a[1] - right) - Math.abs(b[1] - right)))
          .slice(0, 8)
          .map(([id, v]) => (
            <li key={id} className={`${closest.has(id) ? "closest" : ""}${id === me ? " me" : ""}`}>
              <span>{nameOf(game, id)}</span>
              <span className="jqzz-annot">
                {plain(v)}
                {unit}
                {right != null ? ` · ${plain(Math.abs(v - right))} off` : ""}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
};
