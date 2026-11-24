import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CharacterGrid } from '../components/CharacterGrid';
import { DetailSheet } from '../components/DetailSheet';
import { Footer } from '../components/Footer';
import { Glyph, IconEmpty, UniversalMark } from '../components/Icons';
import { SearchBar } from '../components/SearchBar';
import { Section } from '../components/Section';
import { TabBar, TopBar } from '../components/TopBar';
import { loadAddonIndex, loadAddons, loadOwners, loadPerks } from '../data/api';
import { rarityStyle } from '../lib/rarity';
import { matchesAllTerms, matchesQuery, normText } from '../lib/search';
import type { AddonIndexEntry, Entry, Owner, OwnersFile, Rarity, Side } from '../types';
import { RARITY_LABEL, SIDE_LABEL, isSide } from '../types';

/** 角色总览里跨角色搜到的条目（技能或配件） */
interface CrossHit {
  id: string;
  kind: 'perk' | 'addon';
  title: string;
  icon: string | null;
  rarity: Rarity | null;
  ownerId: string;
  glyph: number;
}

/**
 * 搜索框下方的快捷筛选词，**按实测命中总量从高到低排序**。
 * 只用有真实命中的效果词，避免点了是空结果。
 * 命中量 = 杀手技能 + 人类技能 + 配件（构建期用真实数据统计）。
 * 可多选，多选是 **AND**：必须同时满足所有选中的词。
 */
const FILTER_TERMS = [
  '气场', // 276
  '发电机', // 127
  '治疗', // 99
  '恐惧范围', // 98
  '受伤', // 76
  '破坏', // 63
  '急速', // 57
  '图腾', // 46
  '翻越', // 45
  '疲劳', // 43
  '无法侦测', // 43
  '钩住', // 42
  '钩子', // 29
  '厄咒', // 24
  '血祭品', // 23
  '出口大门', // 22
  '致盲', // 13
  '恩赐', // 8
];

/** 跨角色结果一次最多渲染多少条（搜「逃生者」这类泛词会命中几百条） */
const MAX_CROSS_HITS = 60;

/**
 * 记录上次查看的角色（本地存储，隐私模式下静默失败）。
 * 早期还用它在总览上给该角色描一圈血环，但会和「按下变红」的反馈混淆，
 * 所以现在只写不读 —— 留作后续「快速回到上次」入口的数据基础。
 */
const lastKey = (side: Side) => `dbd:last:${side}`;
function writeLast(side: Side, ownerId: string) {
  try {
    localStorage.setItem(lastKey(side), ownerId);
  } catch {
    /* 忽略 */
  }
}

export default function Browse() {
  const { side: sideParam, ownerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const side: Side = isSide(sideParam) ? sideParam : 'killer';

  const mainRef = useRef<HTMLElement>(null);
  const scrollPos = useRef<Record<Side, number>>({ killer: 0, survivor: 0 });

  const [ownersFile, setOwnersFile] = useState<OwnersFile | null>(null);
  const [ownersError, setOwnersError] = useState<string | null>(null);

  const [perks, setPerks] = useState<Entry[]>([]);
  const [addons, setAddons] = useState<Entry[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  /** 跨角色搜配件用的轻量索引，只在总览打开搜索时按需加载一次 */
  const [addonIndex, setAddonIndex] = useState<AddonIndexEntry[]>([]);

  const [sheetEntry, setSheetEntry] = useState<Entry | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** 已选中的效果筛选词，可多选；与输入框关键词是 AND 关系 */
  const [activeChips, setActiveChips] = useState<string[]>([]);
  /**
   * 搜索框打开时是否自动聚焦（弹起键盘）。
   * 从角色页返回并还原搜索态时为 false —— 那时用户是「回来看看结果」，
   * 不是「准备输入」，手机上自动弹键盘会直接挡住半屏。
   */
  const [searchAutoFocus, setSearchAutoFocus] = useState(true);

  const drilled = Boolean(ownerId);

  /* ---------- 角色总览：只加载 owners.json ---------- */
  useEffect(() => {
    let alive = true;
    loadOwners()
      .then((f) => {
        if (alive) setOwnersFile(f);
      })
      .catch((e: unknown) => {
        if (alive) setOwnersError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const owners = useMemo(
    () => ownersFile?.owners.filter((o) => o.side === side) ?? [],
    [ownersFile, side],
  );

  /**
   * 顶栏显示的角色数。
   * 「通用」是一个 id 为 universal 的伪角色（承载通用技能/配件），
   * 它会出现在角色网格里，但**不该计入角色数** —— 否则杀手 45、人类 54 会各多算一个。
   */
  const ownerCount = useMemo(
    () => owners.filter((o) => o.id !== 'universal').length,
    [owners],
  );

  const owner: Owner | null = useMemo(
    () => (ownerId ? (owners.find((o) => o.id === ownerId) ?? null) : null),
    [owners, ownerId],
  );

  /* ---------- 切换阵营：载入该阵营全部技能 ---------- */
  useEffect(() => {
    let alive = true;
    setPerks([]);
    loadPerks(side)
      .then((p) => {
        if (alive) setPerks(p);
      })
      .catch((e: unknown) => {
        if (alive) setContentError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [side]);

  /* ---------- 钻取：按角色加载配件分包 ----------
     没有配件的角色（含「通用」）直接跳过请求，不发无意义的 404。 */
  const addonCount = owner?.counts.addon ?? 0;
  useEffect(() => {
    setContentError(null);
    if (!ownerId || addonCount === 0) {
      setAddons([]);
      setContentLoading(false);
      return;
    }
    let alive = true;
    setAddons([]);
    setContentLoading(true);
    loadAddons(ownerId)
      .then((a) => {
        if (!alive) return;
        setAddons(a);
        setContentLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setContentError(e instanceof Error ? e.message : String(e));
        setContentLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ownerId, addonCount]);

  /* ---------- 记录上次查看的角色 ---------- */
  useEffect(() => {
    if (ownerId && owner) writeLast(side, ownerId);
  }, [ownerId, owner, side]);

  /* ---------- 路由变化：关抽屉、关搜索、复位或恢复滚动位置 ---------- */
  const lastSide = useRef<Side>(side);
  /** 打开搜索前的主区滚动位置（关闭搜索后还原） */
  const beforeSearchScroll = useRef(0);
  /**
   * 「在搜索页点进某个角色」时把搜索条件临时存下来，返回总览时还原。
   *
   * 用 ref 而不是 URL 参数：搜索框每敲一个字都写进 URL 会污染历史记录，
   * 而这里只需要跨越一次路由跳转还记得。只在「带着内容离开搜索页」时才存，
   * 空搜索框点进角色 → 返回仍是普通总览（跟以前一致）。
   */
  const searchMemory = useRef<{ query: string; chips: string[] } | null>(null);

  useEffect(() => {
    /* ① 离开总览进角色页之前，先把搜索条件记下来 */
    if (drilled && searchOpen && (query.trim().length > 0 || activeChips.length > 0)) {
      searchMemory.current = { query, chips: activeChips };
    }

    setSheetEntry(null);
    setSearchOpen(false);
    setQuery('');
    setActiveChips([]);
    /* 路由换了就不再还原「搜索前的滚动位置」，
       否则会和下面分支里的「回到顶部 / 恢复上次位置」打架 */
    beforeSearchScroll.current = 0;

    /* 切换阵营 = 回到最上面，并清掉该阵营记住的位置和搜索记忆
       （搜索词是按阵营算的，跨阵营还原没有意义） */
    const switched = lastSide.current !== side;
    if (switched) {
      lastSide.current = side;
      scrollPos.current[side] = 0;
      searchMemory.current = null;
      mainRef.current?.scrollTo({ top: 0 });
      return;
    }

    /* ② 回到总览且手上有搜索记忆 → 直接还原成搜索页。
          不自动聚焦输入框，否则手机会立刻弹起键盘挡住半屏结果。 */
    if (!drilled && searchMemory.current) {
      const mem = searchMemory.current;
      searchMemory.current = null; // 只还原一次，之后返回就是普通总览
      setSearchAutoFocus(false);
      setSearchOpen(true);
      setQuery(mem.query);
      setActiveChips(mem.chips);
      return;
    }

    if (drilled) {
      mainRef.current?.scrollTo({ top: 0 });
    } else if (ownersFile) {
      const y = scrollPos.current[side] ?? 0;
      requestAnimationFrame(() => mainRef.current?.scrollTo({ top: y }));
    }
  }, [side, ownerId, drilled, ownersFile]);

  /**
   * 打开搜索时主区回到顶部。
   * 角色总览可能已经滚动到「迈尔斯」附近，此时点搜索如果沿用原来的滚动位置，
   * 结果列表会从半空中开始 —— 顶部几条被裁掉，看起来像搜索坏了。
   * 关闭搜索后再回到原来的位置，不让人丢失浏览进度。
   */
  useEffect(() => {
    if (searchOpen) {
      beforeSearchScroll.current = mainRef.current?.scrollTop ?? 0;
      mainRef.current?.scrollTo({ top: 0 });
      return;
    }
    const y = beforeSearchScroll.current;
    if (y > 0) {
      beforeSearchScroll.current = 0;
      requestAnimationFrame(() => mainRef.current?.scrollTo({ top: y }));
    }
  }, [searchOpen]);

  const handleScroll = () => {
    // 搜索态滚动的是结果列表，不应该覆盖总览记住的位置
    if (drilled || searchOpen) return;
    scrollPos.current[side] = mainRef.current?.scrollTop ?? 0;
  };

  /* ---------- 总览打开搜索时，按需加载配件索引 ---------- */
  useEffect(() => {
    // 配件只属于杀手阵营，人类页不需要这份索引
    if (!searchOpen || drilled || side !== 'killer' || addonIndex.length) return;
    let alive = true;
    loadAddonIndex()
      .then((idx) => {
        if (alive) setAddonIndex(idx);
      })
      .catch(() => {
        /* 索引加载失败只是不能跨角色搜配件，不影响其他功能 */
      });
    return () => {
      alive = false;
    };
  }, [searchOpen, drilled, side, addonIndex.length]);

  /* ---------- 非法 ownerId ---------- */
  useEffect(() => {
    if (ownersFile && ownerId && !owner) navigate(`/${side}`, { replace: true });
  }, [ownersFile, ownerId, owner, side, navigate]);

  const ownerPerks = useMemo(
    () => (ownerId ? perks.filter((p) => p.ownerId === ownerId) : []),
    [perks, ownerId],
  );

  /* ---------- 搜索 ---------- */
  // 总览：搜角色 + 全站技能/配件（技能已全量加载，配件走轻量索引）
  // 钻取后：只搜该角色的条目

  /** 当前阵营下真正有命中的筛选词（例如「无法侦测」在人类侧一个技能都没有，就不显示） */
  const availableChips = useMemo(() => {
    const withOwner = perks.filter((p) => p.ownerId);
    if (!withOwner.length) return [];
    return FILTER_TERMS.filter((term) => {
      const t = normText(term);
      return withOwner.some((p) => normText((p.description ?? []).join('') + p.title).includes(t));
    });
  }, [perks]);

  /** 已选筛选词的归一化形式，渲染前算一次 */
  const activeChipNorms = useMemo(() => activeChips.map(normText), [activeChips]);

  /**
   * 阵营切换后，词表可能变了（人类侧没有「无法侦测」）。
   * 这里把已经不可用的选中项剔掉，避免它们继续在后台悄悄过滤。
   * 词表为空说明技能还在加载，此时不能剪 —— 否则会瞬间清空用户的选择。
   */
  useEffect(() => {
    if (!availableChips.length) return;
    setActiveChips((prev) => {
      const next = prev.filter((t) => availableChips.includes(t));
      return next.length === prev.length ? prev : next;
    });
  }, [availableChips]);

  /** 条目全文（标题 + 描述，归一化），用于关键词搜索与多选筛选 */
  const perkTextById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perks) m.set(p.id, normText(p.title + (p.description ?? []).join('')));
    return m;
  }, [perks]);

  /**
   * 角色命中（只受关键词影响）。
   * 筛选词描述的是**效果**，角色本身没有效果正文，所以一旦选了筛选词，
   * 结果区就只列条目、不列角色 —— 否则「气场」这种大词会把 44 个杀手
   * 全铺在前面，真正想找的技能被挤到几屏之后。
   */
  const ownerHits = useMemo(
    () => owners.filter((o) => matchesQuery(query, o.name, o.nameEn, o)),
    [owners, query],
  );

  const entryHits = useMemo(() => {
    if (!drilled) return [] as Entry[];
    // 条目数量在钻取态只有 20 条左右，描述正文直接现算，不用额外缓存
    return [...ownerPerks, ...addons].filter((e) => {
      const text = normText(e.title + (e.description ?? []).join(''));
      if (!matchesAllTerms(text, activeChipNorms)) return false;
      return matchesQuery(query, e.title, e.titleEn, e, text);
    });
  }, [drilled, ownerPerks, addons, query, activeChipNorms]);

  /** 输入框有词，或选了至少一个筛选词，都算「检索态」 */
  const filtering = query.trim().length > 0 || activeChips.length > 0;

  /**
   * 总览态的跨角色条目命中（**一次遍历算完**，同时给出总数）。
   *
   * 技能：`perks` 本来就按阵营全量加载了，直接用 `perkTextById` 的缓存正文。
   * 配件：用构建期产出的 `addons-index.json`（881 条），避免为了搜索去下载 44 个分包。
   *       ⚠️ 它的 `text` 字段**在构建期就归一化过了**（不含任何标点空白），
   *       这里绝不能再跑一遍 normText —— 每次按键对 881 条正文做全串正则替换，
   *       低端机上打字会明显发涩。
   * 只有输入了关键词或选了筛选词才返回 —— 否则会把上千条糊一屏。
   */
  const crossSearch = useMemo(() => {
    if (drilled || !filtering) return { all: [] as CrossHit[], total: 0 };
    const q = query;
    const all: CrossHit[] = [];

    for (const p of perks) {
      if (!p.ownerId) continue;
      const text = perkTextById.get(p.id) ?? '';
      if (!matchesAllTerms(text, activeChipNorms)) continue;
      if (!matchesQuery(q, p.title, p.titleEn, p, text)) continue;
      all.push({
        id: p.id,
        kind: 'perk',
        title: p.title,
        icon: p.icon,
        rarity: null,
        ownerId: p.ownerId,
        glyph: p.glyph,
      });
    }

    /* 配件只属于杀手阵营：索引是全局的，切到人类页时必须排除，
       否则会在人类搜索里冒出杀手的配件 */
    if (side === 'killer') {
      for (const a of addonIndex) {
        const text = a.text ?? '';
        if (!matchesAllTerms(text, activeChipNorms)) continue;
        if (!matchesQuery(q, a.title, a.titleEn ?? null, a, text)) continue;
        all.push({
          id: a.id,
          kind: 'addon',
          title: a.title,
          icon: a.icon,
          rarity: a.rarity,
          ownerId: a.ownerId,
          glyph: 0,
        });
      }
    }

    return { all, total: all.length };
  }, [drilled, filtering, query, perks, addonIndex, side, perkTextById, activeChipNorms]);

  /** 效果词可能命中几百条（如「逃生者」），先截断避免一次渲染上千行 */
  const crossHits = useMemo(
    () =>
      crossSearch.all.length > MAX_CROSS_HITS
        ? crossSearch.all.slice(0, MAX_CROSS_HITS)
        : crossSearch.all,
    [crossSearch],
  );
  /** 截断前的总数，用于提示「还有 N 条」 */
  const crossHitTotal = crossSearch.total;

  /** ownerId → 角色名，搜索结果里显示归属 */
  const ownerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of ownersFile?.owners ?? []) m.set(o.id, o.name);
    return m;
  }, [ownersFile]);

  /**
   * 是不是「从总览点进来的」。
   * 用来决定返回键走 history.back() 还是 re-navigate：
   *   - 从总览进来 → back()，历史里不会堆积条目（否则退回搜索页后再按一次
   *     系统返回，又会回到刚才那个角色页，很怪）
   *   - 直接深链/刷新进来的 → 没得 back，退回总览
   */
  const arrivedFromOverview = useRef(false);
  const openOwner = (id: string) => {
    arrivedFromOverview.current = true;
    navigate(`/${side}/${id}`);
  };
  const goBack = () => {
    if (arrivedFromOverview.current) {
      arrivedFromOverview.current = false;
      navigate(-1);
      return;
    }
    navigate(`/${side}`);
  };

  /**
   * 从总览的跨角色搜索结果点进来时，landing 到目标角色的页面后把那条自动打开。
   * 条目 id 通过路由 state 传递（不污染 URL）；等该角色的内容加载完再打开，
   * 用 ref 记住已处理过的 id，避免重复触发。
   */
  const handledFocus = useRef<string | null>(null);
  useEffect(() => {
    const focus = (location.state as { focus?: string } | null)?.focus;
    if (!focus || handledFocus.current === focus || !drilled) return;
    const found = ownerPerks.find((e) => e.id === focus) ?? addons.find((e) => e.id === focus);
    if (!found) return; // 内容还没到，等下一轮
    handledFocus.current = focus;
    setSheetEntry(found);
  }, [location.state, drilled, ownerPerks, addons]);

  /* 角色 → 该角色的技能，用于搜索结果右侧显示三个技能图标 */
  const perksByOwner = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const p of perks) {
      if (!p.ownerId) continue;
      const arr = m.get(p.ownerId);
      if (arr) arr.push(p);
      else m.set(p.ownerId, [p]);
    }
    return m;
  }, [perks]);

  const isEmpty = drilled && !contentLoading && ownerPerks.length === 0 && addons.length === 0;

  return (
    <div className="app" data-sheet={sheetEntry ? 'open' : 'closed'}>
      {searchOpen ? (
        <SearchBar
          placeholder={
            drilled
              ? side === 'killer'
                ? '搜这个角色的技能、配件或效果'
                : '搜这个角色的技能或效果'
              : side === 'killer'
                ? '搜角色、技能、配件或效果'
                : '搜角色、技能或效果'
          }
          chips={availableChips}
          activeChips={activeChips}
          onToggleChip={(term) =>
            setActiveChips((prev) =>
              prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term],
            )
          }
          value={query}
          onChange={setQuery}
          autoFocus={searchAutoFocus}
          onClose={() => {
            setSearchOpen(false);
            setQuery('');
            setActiveChips([]);
          }}
        />
      ) : (
        <TopBar
          side={side}
          ownerName={owner?.name ?? null}
          ownerNameEn={owner?.nameEn ?? null}
          ownerCount={ownerCount}
          onBack={goBack}
          onSearch={() => {
            // 用户主动点搜索 → 一定聚焦，准备输入
            setSearchAutoFocus(true);
            setSearchOpen(true);
          }}
        />
      )}

      <main className="main" ref={mainRef} onScroll={handleScroll}>
        {ownersError && (
          <div className="state">
            <strong>角色数据加载失败</strong>
            <span>{ownersError}</span>
          </div>
        )}

        {!ownersError && !ownersFile && <div className="state">正在雾中摸索…</div>}

        {/* ========== 搜索态 ========== */}
        {searchOpen && ownersFile && (
          <div className="results">
            {drilled
              ? entryHits.map((e) => (
                  <button key={e.id} className="res" onClick={() => setSheetEntry(e)}>
                    <span className="res__shape" data-kind={e.kind} style={rarityStyle(e.rarity, 'glow')}>
                      {e.icon ? (
                        <img src={e.icon} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Glyph index={e.glyph} />
                      )}
                    </span>
                    <span className="res__txt">
                      <span className="res__t">{e.title}</span>
                      <span className="res__s">
                        {e.kind === 'perk' ? '技能' : '配件'}
                        {e.rarity ? ` · ${RARITY_LABEL[e.rarity]}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              : activeChips.length
                ? null
                : ownerHits.map((o) => (
                  <button key={`${o.side}:${o.id}`} className="res" onClick={() => openOwner(o.id)}>
                    {/* 复用角色卡的图层结构，保证和总览里的观感一致 */}
                    <span className="char__av res__char" data-role={o.side}>
                      <span className="char__frame" aria-hidden="true" />
                      {o.id === 'universal' ? (
                        <UniversalMark side={o.side} />
                      ) : o.avatar ? (
                        <img src={o.avatar} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="char__ph" aria-hidden="true">
                          {o.name.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    <span className="res__txt">
                      <span className="res__t">{o.name}</span>
                      {/* 副标只留英文名，不再显示技能/配件数量 */}
                      <span className="res__s">{o.nameEn ?? SIDE_LABEL[o.side].cn}</span>
                    </span>
                    {/* 角色右侧带出对应的专属技能（「通用」不显示） */}
                    {o.id !== 'universal' && (perksByOwner.get(o.id)?.length ?? 0) > 0 && (
                      <span className="res__perks" aria-label="专属技能">
                        {perksByOwner.get(o.id)!.map((p) => (
                          <span key={p.id} className="res__mini" title={p.title}>
                            {p.icon ? (
                              <img src={p.icon} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <Glyph index={p.glyph} />
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}

            {/* 总览态：跨角色搜到的技能 / 配件，副标显示归属角色 */}
            {!drilled &&
              crossHits.map((h) => {
                const ownerLabel = ownerNameById.get(h.ownerId) ?? '';
                return (
                  <button
                    key={h.id}
                    className="res"
                    onClick={() => {
                      arrivedFromOverview.current = true;
                      navigate(`/${side}/${h.ownerId}`, { state: { focus: h.id } });
                    }}
                  >
                    <span className="res__shape" data-kind={h.kind} style={rarityStyle(h.rarity, 'glow')}>
                      {h.icon ? (
                        <img src={h.icon} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <Glyph index={h.glyph} />
                      )}
                    </span>
                    <span className="res__txt">
                      <span className="res__t">{h.title}</span>
                      <span className="res__s">
                        {h.kind === 'perk' ? '技能' : '配件'}
                        {h.rarity ? ` · ${RARITY_LABEL[h.rarity]}` : ''}
                        {ownerLabel ? ` · ${ownerLabel}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}

            {/* 结果被截断时提示，避免以为搜漏了 */}
            {!drilled && crossHitTotal > crossHits.length && (
              <div className="results__more">
                还有 {crossHitTotal - crossHits.length} 条未显示，加个关键词或筛选词缩小范围
              </div>
            )}

            {filtering &&
              (drilled
                ? entryHits.length === 0
                : activeChips.length
                  ? crossHits.length === 0
                  : ownerHits.length === 0 && crossHits.length === 0) && (
                <div className="results__empty">
                  <div className="results__empty-t">雾中无此物</div>
                  <div className="results__empty-s">
                    {activeChips.length
                      ? '筛选词是「同时满足」，点掉一个再试试'
                      : '换个关键词，支持中文名、拼音全拼、首字母'}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* ========== 角色总览 ========== */}
        {!searchOpen && !drilled && ownersFile && (
          <>
            <CharacterGrid owners={owners} onOpen={openOwner} />
            <Footer updatedAt={ownersFile.generatedAt} />
          </>
        )}

        {/* ========== 钻取后 ========== */}
        {!searchOpen && drilled && (
          <div className="sections">
            {contentError && (
              <div className="state">
                <strong>内容加载失败</strong>
                <span>{contentError}</span>
              </div>
            )}

            <Section title="技能" entries={ownerPerks} onOpen={setSheetEntry} />
            <Section title="配件" entries={addons} onOpen={setSheetEntry} />

            {contentLoading && <div className="state">正在雾中摸索…</div>}

            {isEmpty && (
              <div className="blank">
                <div className="blank__ic">
                  <IconEmpty />
                </div>
                <div className="blank__t">此处尚未录入</div>
                <div className="blank__s">
                  这个角色还没有整理资料
                  <br />
                  先把主玩的几位补上即可
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <TabBar side={side} onChange={(s) => navigate(`/${s}`)} />

      <DetailSheet
        entry={sheetEntry}
        ownerName={owner?.name ?? SIDE_LABEL[side].cn}
        onClose={() => setSheetEntry(null)}
      />
    </div>
  );
}
