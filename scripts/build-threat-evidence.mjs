import fs from 'node:fs/promises'

const sources = {
  danum: { title: 'SEARRP · Danum Valley research landscape', url: 'https://www.searrp.org/location/', year: null, scope: '丹浓谷及周边研究景观；未获得同口径的逐项威胁等级' },
  sundarbans: { title: 'IUCN World Heritage Outlook · The Sundarbans · 2025', url: 'https://worldheritageoutlook.iucn.org/explore-sites/sundarbans', year: 2025, scope: '孟加拉国孙德尔本斯世界遗产地及影响它的周边地区' },
  serengeti: { title: 'IUCN World Heritage Outlook · Serengeti · 2020', url: 'https://worldheritageoutlook.iucn.org/node/978/pdf?year=2020', year: 2020, scope: '塞伦盖蒂国家公园及周边生态系统；不是2026年现状调查' },
  sagarmatha: { title: 'IUCN World Heritage Outlook · Sagarmatha · 2025', url: 'https://worldheritageoutlook.iucn.org/explore-sites/sagarmatha-national-park', year: 2025, scope: '萨加玛塔国家公园及其缓冲地带' }
}
const columns = ['森林砍伐', '水体污染', '土地退化', '气候变化', '人类开发']
const e = (original, level, note, stage = 'current') => ({ original, level, note, stage })
const rows = {
  danum: columns.map(() => []),
  sundarbans: [[], [e('Water-borne & other effluent Pollution', 3, '工业、农业及水产养殖排放；农用化学物质。'), e('Impacts from the Maitree Super Thermal Power Plant and other industrial developments', 4, '工业发展相关的潜在水污染。', 'potential')],
    [e('Siltation of inland rivers reducing freshwater flow into the mangroves', 4, '以淤积及水盐条件变化作为土地退化的相关压力指标，不是退化面积测量。')],
    [e('Extreme weather events', 4, '气候相关的极端天气。'), e('Sea level rise', 4, '海平面上升的潜在影响。', 'potential')],
    [e('Dam creation resulting in increased salinity and modification to tidal influences on deltaic and bank formation', 4, '上游水坝与水管理改变淡水流入。')]],
  serengeti: [[], [], [e('Livestock Farming / Grazing — Change of land use in adjacent areas', 4, '以周边放牧和土地利用改变作为土地退化的相关压力指标。')],
    [e('Droughts — Climate change', null, '原报告为 Data Deficient，不能推断为低威胁。', 'potential')],
    [e('Tourism infrastructure development', 3, '旅游基础设施。'), e('Water shortage due to upstream dams, irrigation and diversion', 4, '上游水利开发与引水。'), e('Development of road and other infrastructure corridors', 4, '道路与基础设施走廊的潜在影响。', 'potential')]],
  sagarmatha: [[e('Firewood collection', 1, '薪柴采集。')], [e('Increasing human waste and inappropriate treatment practice', 3, '生活污水与废物处理。')],
    [e('Overgrazing by livestock in high mountain pastures', 1, '以高山草场过度放牧作为土地退化的相关压力指标。'), e('Rock extraction', 1, '采石扰动及恢复问题。')],
    [e('Glacial Lake Outburst Floods (GLOFs)', 3, '冰湖溃决风险。'), e('Rising temperatures and altered precipitation patterns', 3, '升温和降水模式变化。')],
    [e('Reported continued operation of the Kongde View Resort', 3, '度假设施开发。')]]
}
await fs.writeFile('public/data/ecology-threats.json', JSON.stringify({ collectedAt: new Date().toISOString(), columns, sources, rows, methodology: '从官方报告选取与五个主题直接相关的条目，展示所选条目的最高等级（非全面风险指数）。1=Low Threat，3=High Threat，4=Very High Threat；不插入原报告没有的中间等级。土地退化列是相关压力代理。空值=没有匹配的已核验分级或Data Deficient，绝不表示无威胁。分级针对遗产地及周边，空间范围不同于GBIF采样窗口；年份和评估范围不完全相同，不宜作严格排名。' }, null, 2))
