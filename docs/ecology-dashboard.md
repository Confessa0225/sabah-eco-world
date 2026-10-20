# 结局生态观察报告

入口：`ecology.html`。动物图鉴集齐后沿原有 2 秒等待 → 5 秒结局文字 → 1.7 秒淡出进入报告；点击可提前结束结局文字。点击与定时器只触发一次跳转。

## 数据快照

- GBIF 出现记录 API，2015–2025 年；采集时间见 JSON。四个查询中心周边约 50×50 km 的经纬度矩形，不是保护区边界、不限定国家，也未按生境栅格裁剪。
- 丹浓谷中心来自项目 map_config；其余为选定对照采样中心。三个对照区并非已有游戏场景。
- 有坐标、无 GBIF 地理问题标志、PRESENT；人工观察、机器观察、保存标本。未按 coordinateUncertaintyInMeters 再次过滤，不能视为所有坐标均精确。
- 完整分页获取 speciesKey facets。按植物界、真菌界及动物纲归类；其余分类单列。物种级归并包含可归属到物种的亚种记录。API 是动态数据库，缓存快照可复核，不是具有 DOI 的正式 GBIF 下载。
- 柱状图是区域内已记录物种数，环形图是跨区物种集合并集。不是记录数占比、个体数量、完整丰富度或随机抽样估计。图例隐藏不改变原始表与 CSV。
- 丹浓谷 1681，孙德尔本斯 303，塞伦盖蒂 701，萨加玛塔 598；跨区去重 3138；出现记录合计 266801。物种数与出现记录数的统计对象不同。
- 游戏动物图鉴目前 10 个条目中 2 个是哺乳动物。泛称条目不是确定的物种，20% 只能作内容结构提示；缺少体重性状，不推断大型哺乳动物比例。

## 证据与重现

`public/data/ecology-observations.json` 含统计、物种标识、查询清单；`data/ecology-evidence/gbif/` 保存 API 原始响应。`node scripts/collect-ecology-data.mjs` 复用缓存重建统计。需要新快照时请先归档整个旧缓存和输出，再清空缓存重新采集；不能把部分缓存拼接成统一新日期的调查。

威胁分级人工核对 IUCN World Heritage Outlook：孙德尔本斯及萨加玛塔 2025，塞伦盖蒂可取得 2020 PDF，见 `data/ecology-evidence/serengeti-2020.pdf`。选用与用户五个主题相关的条目，等级与原始条目见 `public/data/ecology-threats.json`，通过 `node scripts/build-threat-evidence.mjs` 重建。土地退化为相关压力代理，不是直接测量；聚合取当前筛选条目的最高等级，不是完整风险指数。丹浓谷缺乏已核验同口径分级，不补值；未匹配条目与资料不足均显示缺失并在详情解释。评估空间不是 GBIF 窗口，年份不同，不宜直接排名。

底图 `public/data/world-land.geojson`：Natural Earth ne_110m_land，公共领域，源 https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson 。地区及代表性物种来源见页面链接，代表性物种不保证存在于 GBIF 窗口中。

生产构建包含游戏、原落地页和 ecology.html；报告运行时使用本地 JSON，不依赖外部 API。外链仅用于查看来源。

验证：`node --test tests/ecology-data.test.js tests/animal-animation.test.js tests/model-style.test.js`，`npm run build`。
