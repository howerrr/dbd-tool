import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Entry } from '../types';
import { RARITY_LABEL } from '../types';
import { highlightNumbers } from '../lib/highlight';
import { rarityStyle } from '../lib/rarity';
import { Glyph } from './Icons';

const DRAG_CLOSE_PX = 90;

interface Props {
  entry: Entry | null;
  ownerName: string;
  onClose: () => void;
}

/**
 * 底部抽屉。
 * 关键实现点：
 * - 手势只挂在顶部把手上（touch-action:none），内容区保持原生滚动
 * - 下滑超过 90px 关闭
 * - 打开时把正文滚回顶部
 * - 描述里的「数值 + 单位」会被高亮（见 lib/highlight）
 */
export function DetailSheet({ entry, ownerName, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, startY: 0, dy: 0 });
  const open = entry !== null;

  // 每次打开新的条目，正文滚回顶部
  useEffect(() => {
    if (!open) return;
    const body = sheetRef.current?.querySelector('.sheet__body');
    if (body) body.scrollTop = 0;
  }, [entry?.id, open]);

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { on: true, startY: e.clientY, dy: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.on) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };

  const handleUp = () => {
    if (!drag.current.on) return;
    drag.current.on = false;
    const el = sheetRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
    if (drag.current.dy > DRAG_CLOSE_PX) onClose();
  };

  // 详情里的文字与描边用 base 变体（更沉稳）；图标格的色条用 glow（见 Section）
  const rarityVars = rarityStyle(entry?.rarity, 'base');

  return (
    <>
      <div className="backdrop" data-open={open} onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="条目详情"
      >
        <div
          className="sheet__handle"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        >
          <i />
        </div>

        <div className="sheet__body">
          {entry && (
            <>
              <div className="detail-head">
                <div className="detail-head__frame" data-kind={entry.kind} style={rarityVars}>
                  {entry.icon ? (
                    <img src={entry.icon} alt="" decoding="async" />
                  ) : (
                    <Glyph index={entry.glyph} />
                  )}
                </div>
                <div className="detail-head__txt">
                  <h2>{entry.title}</h2>
                  {entry.titleEn && <div className="detail-head__en">{entry.titleEn}</div>}
                  <div className="meta">
                    {entry.kind === 'addon' && entry.rarity ? (
                      <span className="chip chip--rarity" style={rarityVars}>
                        {RARITY_LABEL[entry.rarity]}
                      </span>
                    ) : (
                      <span className="chip">技能</span>
                    )}
                    <span className="chip">{ownerName}</span>
                  </div>
                </div>
              </div>

              <div className="desc">
                {entry.description.length ? (
                  /* 项目符号：数据里用的是 ·（U+00B7），这里同时认 •（U+2022）和 ‧。
                     之前只判 '•'，导致所有条目其实都没走 .bullet 样式（退化成行内小点），
                     改成统一的判据。 */
                  entry.description.map((p, i) =>
                    /^[·•‧]\s*/.test(p) ? (
                      <p className="bullet" key={i}>
                        {highlightNumbers(p.replace(/^[·•‧]\s*/, ''))}
                      </p>
                    ) : (
                      <p key={i}>{highlightNumbers(p)}</p>
                    ),
                  )
                ) : (
                  <p className="desc__empty">描述待补录。</p>
                )}
              </div>

              {entry.flavor && <div className="flavor">{entry.flavor}</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
