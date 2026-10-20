import './ecologyDashboard.css'
import { animalGroups, unionCounts, csvCounts, threatLevel } from './ecologyStats.js'

const app = document.querySelector('#app')
const colors = ['#608a66', '#a48bb0', '#c67d52', '#6292ad', '#aaa451', '#6ca7a0', '#d0ae58', '#bb8193', '#889397']
const names = { danum: '婆罗洲猩猩、犀鸟', sundarbans: '孟加拉虎、湾鳄、桑德里树（Heritiera fomes）', serengeti: '角马、斑马、瞪羚', sagarmatha: '雪豹、小熊猫' }
const links = { danum: 'https://danumvalley.my/management/', sundarbans: 'https://whc.unesco.org/en/list/798/', serengeti: 'https://whc.unesco.org/en/list/156/', sagarmatha: 'https://whc.unesco.org/en/list/120/' }
const n = value => value.toLocaleString('zh-CN')
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`
const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0)
const levelNames = { 1: '低', 3: '高', 4: '极高' }
const state = { region: 'all', animalsOnly: false, groups: new Set(), stage: 'all', zoom: 1 }
let data, threats, land

async function load() {
  try {
    const files = ['ecology-observations.json', 'ecology-threats.json', 'world-land.geojson']
    ;[data, threats, land] = await Promise.all(files.map(async file => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
      if (!response.ok) throw new Error(`数据文件 ${file} 加载失败`)
      return response.json()
    }))
    state.groups = new Set(data.groups)
    render()
  } catch (error) {
    app.innerHTML = `<div class="loading"><h1>报告暂时未能打开</h1><p>${esc(error.message)}</p><button id="retry">重新加载</button> <a href="./index.html">返回游戏</a></div>`
    document.querySelector('#retry').onclick = load
  }
}

function render() {
  const union = unionCounts(data.regions, data.groups)
  app.innerHTML = `
    <header><a class="brand" href="./${encodeURI('万物有回声ECHOES OF EARTH.html')}">万物有回声 <span>ECHOES OF EARTH</span></a><nav><a href="#geography">研究区</a><a href="#species">物种</a><a href="#threats">威胁</a><a href="#methods">数据说明</a></nav></header>
    <main>
      <section class="hero"><div><p class="eyebrow">FIELD NOTES / 自然观察报告</p><h1>看见之后，<em>读懂自然。</em></h1><p class="intro">从丹浓谷的一次相遇出发，走向四种生态系统。<br>让真实记录，接续你的探索。</p></div><div class="seal" aria-hidden="true"><span>✳</span><small>EVERY SPECIES<br>HAS A STORY</small></div></section>
      <div class="metrics"><div><strong>04</strong><span>真实研究区 · 1 个游戏场景</span></div><div><strong>${n(sum(union))}</strong><span>跨区去重的已记录物种</span></div><div><strong>${n(data.regions.reduce((s, r) => s + r.recordCount, 0))}</strong><span>筛选范围内的出现记录</span></div><div><strong>2015—2025</strong><span>GBIF 记录年份</span></div></div>
      <p class="notice">这是一份有范围的观察：物种数受调查力度与数据共享程度影响，不代表完整名录，也不能用来评判哪个生态系统更丰富。</p>
      <section class="card" id="geography"><div class="section-head"><div><p class="eyebrow">01 / 地理分布</p><h2>同一个地球，不同的家园</h2></div><span class="caption">点击地图标记或地区按钮</span></div>
        <div id="region-tabs" class="tabs" aria-label="选择研究区域"></div>
        <div class="map-layout"><div class="map-wrap"><div class="map-tools"><button id="zoom-in" aria-label="放大地图">＋</button><button id="zoom-out" aria-label="缩小地图">−</button><button id="zoom-reset">全景</button></div><svg id="map" viewBox="0 0 900 450" role="group" aria-label="四个生态研究区的世界分布"></svg><small class="map-credit">Natural Earth · 1:110m · 等距圆柱投影</small></div><aside id="region-info" aria-live="polite"></aside></div>
      </section>
      <div class="chart-grid"><section class="card" id="species"><div class="section-head"><div><p class="eyebrow">02 / 物种数量</p><h2>记录中，有多少种生命？</h2></div><button id="reset-groups">显示全部类型</button></div><p class="caption">约 50×50 km 窗口内，按物种标识去重。点击图例筛选，点击色块查看数量。</p><div id="group-legend" class="legend"></div><svg id="bars" viewBox="0 0 580 370" role="group" aria-label="四类生态系统已记录物种数堆叠柱状图"></svg><div id="bar-detail" class="detail-line" aria-live="polite">选择柱状图中的色块，查看该类型的记录数量。</div><details><summary>查看完整数据表</summary><div id="count-table" class="table-scroll"></div></details></section>
      <section class="card" id="composition"><div class="section-head"><div><p class="eyebrow">03 / 物种类型</p><h2>目光，是否足够多样？</h2></div></div><div class="controls"><label>研究范围 <select id="donut-region"><option value="all">四区合并 · 物种去重</option>${data.regions.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select></label><label class="check"><input type="checkbox" id="animals-only"> 只看动物</label></div><div class="donut-layout"><svg id="donut" viewBox="0 0 300 300" role="group" aria-label="已记录物种类型比例环形图"></svg><div id="donut-legend" class="donut-legend"></div></div><div id="donut-detail" class="detail-line" aria-live="polite"></div><p id="mammal-note" class="caption"></p><p class="caption">游戏动物图鉴中哺乳动物占 2/10（20%）。这是内容条目比例，部分条目是泛称；无法与真实物种名录直接等同。没有体重性状数据，因此不把全部哺乳动物称为“大型哺乳动物”。</p></section></div>
      <section class="card" id="threats"><div class="section-head"><div><p class="eyebrow">04 / 威胁矩阵</p><h2>它们的家园，正在承受什么？</h2></div><label>评估条目 <select id="threat-stage"><option value="all">当前与潜在</option><option value="current">仅当前威胁</option><option value="potential">仅潜在威胁</option></select></label></div><p class="caption">颜色表示相关条目的最高已公布等级。点击单元格查看原始条目、年份及出处。</p><div class="heat-legend"><span class="l1">低</span><span class="l3">高</span><span class="l4">极高</span><span class="missing">未分级 / 资料不足</span></div><div id="heatmap" class="table-scroll"></div><aside id="threat-detail" class="evidence" aria-live="polite">选择一个单元格，展开对应的证据。</aside><p class="caption">土地退化列使用放牧、采石、淤积等相关压力作为代理，不是退化面积。不同年份、边界和评估对象不可直接排名；未分级绝不等于没有威胁。</p></section>
      <section class="methods" id="methods"><p class="eyebrow">ABOUT THE DATA / 让每一个数字可追溯</p><h2>图表背后，是证据，也有边界。</h2><div class="method-grid"><div><h3>统一筛选，谨慎比较</h3><p>${esc(data.methodology)}</p><p>窗口可能跨越国界或包含多种生境，不是整个保护区，也不是该生态系统的全球统计。按 GBIF speciesKey 归并；四区环形图再次去重，不能简单相加柱状图总数。零表示本次筛选未记录到，不表示当地不存在。</p><p>“其他动物”包括鱼类、蛛形类等；“其他生物”包含未归入前述类群的物种。没有物种级标识的记录不计入物种数，但仍可能计入出现记录数。</p></div><div><h3>分级来自报告，不来自猜测</h3><p>${esc(threats.methodology)}</p><p>丹浓谷尚无本次可核验的同口径等级，保留为空；${link(threats.sources.danum.url, '查看 SEARRP 研究景观说明')}。另外三个地点是尚未制作成游戏场景的对照区。代表性物种来自地区介绍，不保证出现在本次 GBIF 窗口记录中。</p></div></div><div class="sources">${link('https://techdocs.gbif.org/en/openapi/v1/occurrence', 'GBIF API 方法')}${link('https://www.gbif.org/analytics/global', 'GBIF 数据覆盖')}${link('https://www.naturalearthdata.com/about/terms-of-use/', '底图许可')}${Object.values(threats.sources).slice(1).map(s => link(s.url, s.title)).join('')}</div><div class="downloads"><button id="download-csv">下载物种统计 CSV ↓</button><a download href="./data/ecology-observations.json">物种标识与查询清单 JSON ↓</a><a download href="./data/ecology-threats.json">威胁证据 JSON ↓</a></div><p class="caption">GBIF 快照采集：${new Date(data.collectedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）。页面使用本地数据快照，无需现场访问外部 API。原始响应保存在项目 data/ecology-evidence/gbif 中；可用 scripts/collect-ecology-data.mjs 复核。</p></section>
      <footer><p>探索结束了，关注仍在继续。</p><a class="return" href="./${encodeURI('万物有回声ECHOES OF EARTH.html')}">回到万物有回声 ↗</a></footer>
    </main>`
  document.querySelector('#zoom-in').onclick = () => { state.zoom = Math.min(3, state.zoom + .5); drawMap() }
  document.querySelector('#zoom-out').onclick = () => { state.zoom = Math.max(1, state.zoom - .5); drawMap() }
  document.querySelector('#zoom-reset').onclick = () => { state.zoom = 1; drawMap() }
  document.querySelector('#donut-region').onchange = event => selectRegion(event.target.value)
  document.querySelector('#animals-only').onchange = event => { state.animalsOnly = event.target.checked; drawDonut() }
  document.querySelector('#threat-stage').onchange = event => { state.stage = event.target.value; drawThreats(); document.querySelector('#threat-detail').textContent = '筛选已更新。选择单元格查看此范围内的评估条目。' }
  document.querySelector('#reset-groups').onclick = () => { state.groups = new Set(data.groups); drawBars() }
  document.querySelector('#download-csv').onclick = () => {
    const url = URL.createObjectURL(new Blob([csvCounts(data)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = '生态研究区-GBIF物种统计-2015-2025.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  drawMap(); drawBars(); drawDonut(); drawThreats()
  document.querySelector('#count-table').innerHTML = `<table><caption>全部类型的原始统计（不随图例隐藏）</caption><thead><tr><th scope="col">类型</th>${data.regions.map(r => `<th scope="col">${r.name}</th>`).join('')}</tr></thead><tbody>${data.groups.map(g => `<tr><th scope="row">${g}</th>${data.regions.map(r => `<td>${n(r.counts[g])}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">合计</th>${data.regions.map(r => `<td>${n(r.speciesCount)}</td>`).join('')}</tr></tbody></table>`
}

function activate(element, callback) {
  element.addEventListener('click', callback)
  element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callback() } })
}
function selectRegion(id) { state.region = id; document.querySelector('#donut-region').value = id; drawMap(); drawDonut() }
const project = ([lon, lat]) => [(lon + 180) * 2.5, (90 - lat) * 2.5]
function drawMap() {
  const selected = data.regions.find(r => r.id === state.region)
  const svg = document.querySelector('#map')
  const center = selected ? project([selected.lon, selected.lat]) : [600, 230]
  const width = 900 / state.zoom, height = 450 / state.zoom
  const x = Math.max(0, Math.min(900 - width, center[0] - width / 2)), y = Math.max(0, Math.min(450 - height, center[1] - height / 2))
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`)
  const paths = land.features.map(f => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    return `<path d="${polygons.map(p => p.map(ring => ring.map((coord, i) => `${i ? 'L' : 'M'}${project(coord).join(',')}`).join('') + 'Z').join('')).join('')}"/>`
  }).join('')
  svg.innerHTML = `<g class="graticule">${[-60, -30, 0, 30, 60].map(lat => `<path d="M0,${project([0, lat])[1]}H900"/>`).join('')}${[-120, -60, 0, 60, 120].map(lon => `<path d="M${project([lon, 0])[0]},0V450"/>`).join('')}</g><g class="land">${paths}</g>${data.regions.map((r, i) => {
    const [px, py] = project([r.lon, r.lat]); const active = state.region === r.id
    return `<g class="map-marker ${active ? 'active' : ''}" data-region="${r.id}" tabindex="0" role="button" aria-label="${r.name}，${r.country}，${r.ecosystem}"><title>${r.name} · ${r.country} · ${r.role}</title><circle cx="${px}" cy="${py}" r="${active ? 12 : 8}" class="halo"/><circle cx="${px}" cy="${py}" r="4"/><text x="${px + (i === 1 ? 10 : -10)}" y="${py + (i === 3 ? -12 : 18)}" text-anchor="${i === 1 ? 'start' : 'end'}">${r.name}</text></g>`
  }).join('')}`
  svg.querySelectorAll('[data-region]').forEach(el => activate(el, () => selectRegion(el.dataset.region)))
  document.querySelector('#region-tabs').innerHTML = [{ id: 'all', name: '全部研究区' }, ...data.regions].map(r => `<button data-region="${r.id}" aria-pressed="${r.id === state.region}">${r.name}${r.ecosystem ? ` · ${r.ecosystem}` : ''}</button>`).join('')
  document.querySelectorAll('#region-tabs button').forEach(el => { el.onclick = () => selectRegion(el.dataset.region) })
  document.querySelector('#region-info').innerHTML = selected ? `<span class="tag">${selected.role}</span><h3>${selected.name}</h3><p>${selected.country} · ${selected.ecosystem}</p><p class="coordinates">${Math.abs(selected.lat).toFixed(3)}° ${selected.lat < 0 ? 'S' : 'N'} / ${selected.lon.toFixed(3)}° E</p><hr><p class="caption">代表性生物</p><p>${names[selected.id]}</p><p>${link(links[selected.id], '地区与物种介绍')}</p><p class="caption">采样中心周边约 50×50 km<br>经度 ${selected.bounds[0]}—${selected.bounds[2]}<br>纬度 ${selected.bounds[1]}—${selected.bounds[3]}</p><strong>${n(selected.speciesCount)} 种</strong><p class="caption">${n(selected.recordCount)} 条出现记录 · ${link(selected.queryUrl, '核验 GBIF 查询')}</p>` : `<span class="tag">一场探索 · 四处对照</span><h3>从雨林到雪山</h3><p>丹浓谷是游戏所在地区。孙德尔本斯、塞伦盖蒂与萨加玛塔是生态对照区。</p><p class="caption">点击地点，查看国家、生态系统、代表性生物与数据窗口。地图与环形图的研究区选择会同步。</p><hr><p class="caption">地图上的点是查询中心；不是保护区边界。三个对照区尚未制作成游戏场景。</p>`
}

function drawBars() {
  const legend = document.querySelector('#group-legend')
  legend.innerHTML = data.groups.map((g, i) => `<button data-group="${g}" aria-pressed="${state.groups.has(g)}"><i style="background:${colors[i]}"></i>${g}</button>`).join('')
  legend.querySelectorAll('button').forEach(el => { el.onclick = () => { state.groups.has(el.dataset.group) ? state.groups.delete(el.dataset.group) : state.groups.add(el.dataset.group); drawBars() } })
  const totals = data.regions.map(r => [...state.groups].reduce((s, g) => s + r.counts[g], 0))
  const max = Math.max(1, ...totals), top = Math.ceil(max / 5) * 5, baseline = 302, h = 255
  let markup = `<text x="48" y="16" class="axis-label">已记录物种数 / 种</text>`
  for (let i = 0; i <= 5; i++) { const y = baseline - i / 5 * h; markup += `<path class="gridline" d="M48 ${y}H566"/><text class="tick" x="40" y="${y + 4}" text-anchor="end">${Math.round(top * i / 5)}</text>` }
  data.regions.forEach((r, index) => {
    const x = 82 + index * 124; let y = baseline
    data.groups.forEach((g, i) => { if (!state.groups.has(g) || !r.counts[g]) return
      const bh = r.counts[g] / top * h; y -= bh
      markup += `<rect x="${x}" y="${y}" width="56" height="${bh}" fill="${colors[i]}" tabindex="0" role="button" data-region="${r.id}" data-group="${g}" aria-label="${r.ecosystem} ${r.name} ${g} ${r.counts[g]}种"><title>${r.name} · ${g}：${r.counts[g]} 种</title></rect>`
    })
    markup += `<text x="${x + 28}" y="${y - 9}" text-anchor="middle" class="bar-total">${n(totals[index])}</text><text x="${x + 28}" y="328" text-anchor="middle">${r.ecosystem}</text><text x="${x + 28}" y="350" text-anchor="middle" class="tick">${r.name}</text>`
  })
  document.querySelector('#bars').innerHTML = markup
  document.querySelectorAll('#bars rect').forEach(el => activate(el, () => {
    const r = data.regions.find(r => r.id === el.dataset.region), g = el.dataset.group
    document.querySelector('#bar-detail').innerHTML = `<strong>${r.name} · ${g}：${n(r.counts[g])} 种</strong>，占该区域已记录物种的 ${(r.counts[g] / r.speciesCount * 100).toFixed(1)}%。${link(r.queryUrl, '数据查询')}`
  }))
  if (!state.groups.size) document.querySelector('#bar-detail').textContent = '尚未选择类型。点击上方图例或“显示全部类型”恢复图表。'
}

function drawDonut() {
  const regions = state.region === 'all' ? data.regions : data.regions.filter(r => r.id === state.region)
  const groups = state.animalsOnly ? animalGroups : data.groups
  const counts = unionCounts(regions, groups), total = sum(counts)
  let offset = 0
  const circle = 2 * Math.PI * 105
  document.querySelector('#donut').innerHTML = `<circle cx="150" cy="150" r="105" fill="none" stroke="#eee9de" stroke-width="38"/>${groups.map(g => {
    const length = counts[g] / total * circle || 0, i = data.groups.indexOf(g)
    const result = counts[g] ? `<circle class="slice" cx="150" cy="150" r="105" fill="none" stroke="${colors[i]}" stroke-width="38" stroke-dasharray="${length} ${circle - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 150 150)" tabindex="0" role="button" data-group="${g}" aria-label="${g} ${counts[g]}种 ${(counts[g] / total * 100).toFixed(1)}%"><title>${g}：${counts[g]} 种</title></circle>` : ''
    offset += length; return result
  }).join('')}<text x="150" y="149" text-anchor="middle" class="donut-total">${n(total)}</text><text x="150" y="177" text-anchor="middle" class="tick">${state.animalsOnly ? '动物物种' : '去重物种'} / 种</text>`
  document.querySelector('#donut-legend').innerHTML = groups.map(g => `<button data-group="${g}"><i style="background:${colors[data.groups.indexOf(g)]}"></i><span>${g}</span><strong>${(counts[g] / total * 100 || 0).toFixed(1)}%</strong></button>`).join('')
  const detail = g => { document.querySelector('#donut-detail').textContent = `${g} · ${n(counts[g])} 种 · ${(counts[g] / total * 100 || 0).toFixed(1)}%${counts[g] ? '' : '（本次筛选未记录到，不代表当地不存在）'}` }
  document.querySelectorAll('#donut [data-group], #donut-legend [data-group]').forEach(el => activate(el, () => detail(el.dataset.group)))
  detail(groups[0])
  const animalCounts = unionCounts(regions, animalGroups), animalTotal = sum(animalCounts)
  document.querySelector('#mammal-note').textContent = `${state.region === 'all' ? '四区合并去重' : regions[0].name}：在 ${n(animalTotal)} 种已记录动物中，哺乳动物 ${n(animalCounts['哺乳动物'])} 种，占 ${(animalCounts['哺乳动物'] / animalTotal * 100 || 0).toFixed(1)}%。这是数据库覆盖结构，不是自然界各类群的真实比例。`
}

function drawThreats() {
  document.querySelector('#heatmap').innerHTML = `<table class="heat-table"><caption class="sr-only">五类威胁的已核验等级</caption><thead><tr><th scope="col">研究区 / 评估年份</th>${threats.columns.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${data.regions.map(r => `<tr><th scope="row">${r.name}<small>${threats.sources[r.id].year || '未取得同口径等级'}</small></th>${threats.rows[r.id].map((evidence, i) => {
    const level = threatLevel(evidence, state.stage)
    return `<td><button class="${level ? `l${level}` : 'missing'}" data-region="${r.id}" data-column="${i}" aria-label="${r.name} ${threats.columns[i]} ${levelNames[level] || '未分级或资料不足'}">${levelNames[level] || '—'}</button></td>`
  }).join('')}</tr>`).join('')}</tbody></table>`
  document.querySelectorAll('#heatmap button').forEach(el => { el.onclick = () => {
    const id = el.dataset.region, i = Number(el.dataset.column), source = threats.sources[id], r = data.regions.find(r => r.id === id)
    const evidence = threats.rows[id][i].filter(e => state.stage === 'all' || e.stage === state.stage)
    document.querySelector('#threat-detail').innerHTML = `<h3>${r.name} · ${threats.columns[i]}</h3><p class="caption">${source.year || '未分级'} · ${source.scope}</p>${evidence.length ? `<ul>${evidence.map(e => `<li><strong>${e.level ? levelNames[e.level] + '威胁' : '资料不足'} · ${e.stage === 'current' ? '当前' : '潜在'}</strong> — ${esc(e.note)}<small>原始条目：${esc(e.original)}</small></li>`).join('')}</ul>` : '<p>当前筛选下，没有已核验的匹配分级。空白并不表示这里没有这种威胁。</p>'}<p>${link(source.url, source.title)}</p>`
    document.querySelectorAll('#heatmap button').forEach(button => button.setAttribute('aria-pressed', String(button === el)))
  } })
}
load()
