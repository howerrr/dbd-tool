import { IconBilibili } from './Icons';

/** 作者 B 站主页 */
const AUTHOR_URL = 'https://space.bilibili.com/437656202';
/** CC BY-NC-SA 4.0 中文协议文本（BY 署名要求链接到协议） */
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh';

interface Props {
  /** owners.json 的 generatedAt，用来显示数据更新日期 */
  updatedAt?: string;
}

/**
 * 页面底部。
 *
 * 只占「一段说明 + 一行落款」，尽量少占屏幕：
 *   - 说明合成一段：非官方声明 + 两处来源署名（CC BY-NC-SA 的 BY 要求，不能删）
 *   - 落款一行：`更新于 2026-11-24 · [icon] 联系作者`，靠右
 * 桌面端（≥900px）由 CSS 的 `margin-top: auto` 把它压到容器下沿，见 app.css。
 */
export function Footer({ updatedAt }: Props) {
  // generatedAt 是 ISO 串，只取日期部分
  const date = updatedAt?.slice(0, 10) ?? '';

  return (
    <footer className="foot">
      <p className="foot__v">
        非官方粉丝作品，与 Behaviour Interactive Inc. 无关。文本来自
        <a href="https://dbdwiki.com" target="_blank" rel="noopener noreferrer">
          迷雾笔记
        </a>
        （
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
          CC BY-NC-SA 4.0
        </a>
        ），图标与角色图来自
        <a href="https://deadbydaylight.wiki.gg" target="_blank" rel="noopener noreferrer">
          Dead by Daylight Wiki
        </a>
        。
      </p>

      <div className="foot__bar">
        <span className="foot__date">{date ? `更新于 ${date}` : ''}</span>
        <a className="foot__author" href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
          <IconBilibili />
          联系作者
        </a>
      </div>
    </footer>
  );
}
