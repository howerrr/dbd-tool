import { useEffect, useRef } from 'react';
import { IconBack, IconSearch } from './Icons';

interface Props {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  /** 当前阵营可用的快捷筛选词 */
  chips?: string[];
  /** 已选中的筛选词（多选，AND 关系） */
  activeChips?: string[];
  /** 点 chip：没选就加上，已选就去掉 */
  onToggleChip?: (term: string) => void;
  /**
   * 打开时是否自动聚焦输入框（手机会弹起键盘）。
   * 默认 true；「从角色页返回并还原搜索态」时传 false。
   */
  autoFocus?: boolean;
}

/**
 * 搜索态下替换顶栏：返回 + 输入框 + 一排快捷筛选chip。
 *
 * chip 是**独立的多选筛选**，不再占用输入框内容：
 * 输入框还是原来的关键词搜索，chip 追加「必须包含这些效果」的条件，
 * 两者是 AND。再点一次已选中的 chip 就取消它。
 */
export function SearchBar({
  placeholder,
  value,
  onChange,
  onClose,
  chips = [],
  activeChips = [],
  onToggleChip,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 打开即聚焦；iOS 需要一点延迟才认
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [autoFocus]);

  return (
    <div className="searchbar">
      <div className="searchbar__row">
        <button className="topbar__back" onClick={onClose} aria-label="关闭搜索">
          <IconBack />
        </button>
        <div className="field">
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <button className="field__clear" onClick={() => onChange('')} aria-label="清空">
              ×
            </button>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="chips" role="group" aria-label="效果筛选（可多选）">
          {chips.map((t) => (
            <button
              key={t}
              className="chip-btn"
              aria-pressed={activeChips.includes(t)}
              onClick={() => onToggleChip?.(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
