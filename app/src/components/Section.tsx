import type { Entry } from '../types';
import { rarityStyle } from '../lib/rarity';
import { Glyph } from './Icons';

interface SectionProps {
  title: string;
  entries: Entry[];
  onOpen: (entry: Entry) => void;
}

/**
 * 一个内容分区（技能 / 配件）。
 * 技能走 auto-fit 自适应铺满（3 条时撑满整行）；
 * 配件固定 5 列，四边框 + 底部色条都按稀有度着色。
 */
export function Section({ title, entries, onOpen }: SectionProps) {
  if (!entries.length) return null;
  const kind = entries[0].kind;

  return (
    <section className="sect">
      <div className="sect__head">
        <span className="sect__t">{title}</span>
        <span className="sect__line" />
      </div>
      <div className={`grid grid--${kind}`}>
        {entries.map((e) => (
          <button
            key={e.id}
            className="cell"
            data-kind={e.kind}
            style={rarityStyle(e.rarity, 'glow')}
            onClick={() => onOpen(e)}
          >
            <span className="cell__frame">
              <span className="cell__ic">
                {e.icon ? <img src={e.icon} alt="" loading="lazy" decoding="async" /> : <Glyph index={e.glyph} />}
              </span>
            </span>
            <span className="cell__nm">{e.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
