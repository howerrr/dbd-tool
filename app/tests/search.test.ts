// 用 Node 内置 test runner 直接跑 TS（Node 22.6+ 类型擦除）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchesAllTerms, matchesQuery, normText } from '../src/lib/search.ts';

const owners = JSON.parse(fs.readFileSync('public/data/owners.json', 'utf8')).owners;
/** 杀手技能：用于验证多选筛选（AND）在真实正文上的行为 */
const killerPerks = JSON.parse(fs.readFileSync('public/data/perks/killer.json', 'utf8'));

/** 条目全文（标题 + 描述），和 Browse.tsx 里的归一化口径保持一致 */
const perkText = (p) => normText(p.title + (p.description ?? []).join(''));

/** 按 id 找到真实角色，用它真实的拼音字段做断言 */
const find = (name) => owners.find((o) => o.name === name);

test('中文名匹配', () => {
  const o = find('设陷者');
  assert.ok(matchesQuery('设陷', o.name, o.nameEn, o));
  assert.ok(matchesQuery('陷者', o.name, o.nameEn, o)); // 名字中段
});

test('拼音全拼：前缀与包含', () => {
  const o = find('设陷者');
  assert.ok(matchesQuery('she', o.name, o.nameEn, o));
  assert.ok(matchesQuery('shexianzhe', o.name, o.nameEn, o));
  assert.ok(matchesQuery('xianzhe', o.name, o.nameEn, o)); // 包含
});

test('拼音首字母', () => {
  const o = find('设陷者');
  assert.ok(matchesQuery('sxz', o.name, o.nameEn, o));
  assert.ok(matchesQuery('s', o.name, o.nameEn, o));
});

test('大小写与标点不敏感', () => {
  const o = find('迈克尔·迈尔斯');
  assert.ok(matchesQuery('迈克尔迈尔斯', o.name, o.nameEn, o)); // 去掉 ·
  assert.ok(matchesQuery('迈克尔·迈尔斯', o.name, o.nameEn, o));
  const n = find('NEMESIS');
  assert.ok(matchesQuery('nem', n.name, n.nameEn, n));
});

test('英文名匹配', () => {
  const o = find('农场主');
  assert.ok(matchesQuery('hillbilly', o.name, o.nameEn, o));
  assert.ok(matchesQuery('HILL', o.name, o.nameEn, o));
});

test('ü 归一成 v', () => {
  // 查询侧的 ü 归一：用户输入 nü 应能命中 pinyin 为 nv 的条目
  assert.ok(matchesQuery('nü', '女巫', null, { pinyin: 'nvwu', initials: 'nw' }));
  assert.ok(matchesQuery('nv', '女巫', null, { pinyin: 'nvwu', initials: 'nw' }));
  // 真实数据：确认带「女」的角色拼音里没有残留 ü
  for (const o of owners) {
    assert.equal(/ü/.test(o.pinyin ?? ''), false, `${o.name} 的 pinyin 含未归一的 ü`);
    assert.equal(/ü/.test(o.initials ?? ''), false, `${o.name} 的 initials 含未归一的 ü`);
  }
});

test('空查询返回全部', () => {
  const o = find('设陷者');
  assert.ok(matchesQuery('', o.name, o.nameEn, o));
  assert.ok(matchesQuery('   ', o.name, o.nameEn, o));
});

test('不相关查询不匹配', () => {
  const o = find('设陷者');
  assert.equal(matchesQuery('护士', o.name, o.nameEn, o), false);
  assert.equal(matchesQuery('zzzz', o.name, o.nameEn, o), false);
});

test('全部 99 个角色都能被自己的首字母命中原名', () => {
  let bad = 0;
  for (const o of owners) {
    if (!o.initials) { bad++; continue; }
    if (!matchesQuery(o.initials, o.name, o.nameEn, o)) {
      bad++;
      console.log('  ✗ 首字母未命中:', o.name, o.initials);
    }
  }
  assert.equal(bad, 0, `${bad} 个角色的首字母查询失败`);
});

test('全部角色都能被自己的中文全名命中', () => {
  let bad = 0;
  for (const o of owners) {
    if (!matchesQuery(o.name, o.name, o.nameEn, o)) {
      bad++;
      console.log('  ✗ 全名未命中:', o.name);
    }
  }
  assert.equal(bad, 0, `${bad} 个角色的全名查询失败`);
});

/* ---------------- 多选筛选（AND） ---------------- */

test('多选筛选是 AND：空列表全命中，缺一个就不命中', () => {
  const text = normText('对局开始时，一处晦暗图腾将被点亮，你将获得无法侦测状态');
  assert.equal(matchesAllTerms(text, []), true);
  assert.equal(matchesAllTerms(text, [normText('图腾')]), true);
  assert.equal(matchesAllTerms(text, [normText('图腾'), normText('无法侦测')]), true);
  // 顺序无关
  assert.equal(matchesAllTerms(text, [normText('无法侦测'), normText('图腾')]), true);
  // 少一个就整条落选
  assert.equal(matchesAllTerms(text, [normText('图腾'), normText('疲劳')]), false);
});

test('多选「无法侦测」+「图腾」命中厄咒：毁灭序曲，且不含无关条目', () => {
  const terms = [normText('无法侦测'), normText('图腾')];
  const hits = killerPerks.filter((p) => p.ownerId && matchesAllTerms(perkText(p), terms));
  const titles = hits.map((p) => p.title);
  assert.ok(titles.includes('厄咒：毁灭序曲'), `未命中毁灭序曲，实际: ${titles.join('/')}`);
  // 只提到图腾、没提无法侦测的厄咒不该出现
  assert.equal(titles.includes('厄咒：毁灭'), false);
  // 命中数应该远小于单词「图腾」的命中数（25 条）
  assert.ok(hits.length < 10, `命中 ${hits.length} 条，AND 似乎失效了`);
});

test('多选筛选结果一定是各单词结果的交集', () => {
  const a = normText('气场');
  const b = normText('急速');
  const onlyA = killerPerks.filter((p) => p.ownerId && matchesAllTerms(perkText(p), [a]));
  const both = killerPerks.filter((p) => p.ownerId && matchesAllTerms(perkText(p), [a, b]));
  const expected = onlyA.filter((p) => matchesAllTerms(perkText(p), [b]));
  assert.deepEqual(
    both.map((p) => p.id).sort(),
    expected.map((p) => p.id).sort(),
  );
  assert.ok(both.length > 0 && both.length <= onlyA.length);
});
