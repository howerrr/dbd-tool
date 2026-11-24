import type { Owner } from '../types';
import { UniversalMark } from './Icons';

interface Props {
  owners: Owner[];
  onOpen: (ownerId: string) => void;
}

/**
 * 角色总览：6 列竖长方形卡片，不显示名字。
 *
 * 卡片外观来自 wiki 首页名册（`.dbd-main-character-roster`）的三层底图，
 * 已在构建期合成并裁掉透明留白，所以运行时只有一个背景图层：
 *   frame-killer.webp / frame-survivor.webp  —— 阴影 + 卡片底 + 阵营色（红/蓝）
 *   （无损 WebP：渐变用有损会出色带，见 scripts/to-webp.mjs）
 *
 * 头像裁掉了透明边距，并贴着卡片左右下边显示。
 *
 * 「通用」不出角色图，用专属标记放在同一套卡片底上。
 */
export function CharacterGrid({ owners, onOpen }: Props) {
  return (
    <div className="chargrid">
      {owners.map((o) => {
        const empty = o.counts.perk + o.counts.addon === 0;
        const isUniversal = o.id === 'universal';
        return (
          <button
            key={`${o.side}:${o.id}`}
            className="char"
            data-empty={empty}
            data-universal={isUniversal}
            aria-label={o.name}
            title={o.name}
            onClick={() => onOpen(o.id)}
          >
            <span className="char__av" data-role={o.side}>
              <span className="char__frame" aria-hidden="true" />
              {isUniversal ? (
                <UniversalMark side={o.side} />
              ) : o.avatar ? (
                <img src={o.avatar} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="char__ph" aria-hidden="true">
                  {o.name.slice(0, 1)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
