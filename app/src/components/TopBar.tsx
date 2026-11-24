import type { Side } from '../types';
import { SIDE_LABEL } from '../types';
import { IconBack, IconKiller, IconSearch, IconSurvivor } from './Icons';

interface TopBarProps {
  side: Side;
  ownerName: string | null;
  ownerNameEn: string | null;
  /** 该阵营的真实角色数（**不含** id 为 universal 的「通用」伪角色） */
  ownerCount: number;
  onBack: () => void;
  onSearch: () => void;
}

export function TopBar({ side, ownerName, ownerNameEn, ownerCount, onBack, onSearch }: TopBarProps) {
  const drilled = ownerName !== null;
  const label = SIDE_LABEL[side];

  return (
    <header className="topbar">
      {drilled && (
        <button className="topbar__back" onClick={onBack} aria-label="返回角色总览">
          <IconBack />
        </button>
      )}
      <div className="topbar__titles">
        <h1 className="topbar__title">{drilled ? ownerName : label.cn}</h1>
        <div className="topbar__sub">
          {drilled ? (ownerNameEn ?? '') : `${label.en} · ${ownerCount}`}
        </div>
      </div>
      <button className="topbar__act" onClick={onSearch} aria-label="搜索">
        <IconSearch />
      </button>
    </header>
  );
}

interface TabBarProps {
  side: Side;
  onChange: (side: Side) => void;
}

export function TabBar({ side, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="主导航">
      <button
        className="tab"
        aria-selected={side === 'killer'}
        onClick={() => onChange('killer')}
      >
        <IconKiller />
        <span>杀手</span>
      </button>
      <button
        className="tab"
        aria-selected={side === 'survivor'}
        onClick={() => onChange('survivor')}
      >
        <IconSurvivor />
        <span>人类</span>
      </button>
    </nav>
  );
}
