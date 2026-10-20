import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const rawDir = 'data/ecology-evidence/gbif'
await fs.mkdir(rawDir, { recursive: true })
await fs.mkdir('public/data', { recursive: true })
const regions = [
  { id: 'danum', name: '丹浓谷', ecosystem: '森林', country: '马来西亚', lat: 4.98, lon: 117.8, role: '游戏所在地区', source: 'https://danumvalley.my/management/' },
  { id: 'sundarbans', name: '孙德尔本斯', ecosystem: '湿地', country: '孟加拉国', lat: 21.95, lon: 89.183333, role: '对照研究区', source: 'https://whc.unesco.org/en/list/798/' },
  { id: 'serengeti', name: '塞伦盖蒂', ecosystem: '草原', country: '坦桑尼亚', lat: -2.333333, lon: 34.566667, role: '对照研究区', source: 'https://whc.unesco.org/en/list/156/' },
  { id: 'sagarmatha', name: '萨加玛塔', ecosystem: '高山', country: '尼泊尔', lat: 27.965278, lon: 86.913056, role: '对照研究区', source: 'https://whc.unesco.org/en/list/120/' }
]
const groups = ['植物', '真菌', '哺乳动物', '鸟类', '爬行动物', '两栖动物', '昆虫', '其他动物', '其他生物']
const manifest = []
async function request(url) {
  const file = crypto.createHash('sha256').update(url).digest('hex').slice(0, 20) + '.json'
  const target = path.join(rawDir, file)
  let saved
  try { saved = JSON.parse(await fs.readFile(target, 'utf8')) } catch {}
  if (!saved) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) })
        if (!response.ok) throw new Error(`${response.status}: ${url}`)
        saved = { url, retrievedAt: new Date().toISOString(), data: await response.json() }
        await fs.writeFile(target, JSON.stringify(saved))
        break
      } catch (error) {
        if (attempt === 3) throw error
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
  }
  manifest.push({ url, file, retrievedAt: saved.retrievedAt })
  return saved.data
}
function baseParams(region) {
  const halfLat = 25 / 111.32
  const halfLon = 25 / (111.32 * Math.cos(region.lat * Math.PI / 180))
  region.bounds = [region.lon - halfLon, region.lat - halfLat, region.lon + halfLon, region.lat + halfLat].map(n => +n.toFixed(6))
  const [west, south, east, north] = region.bounds
  const params = new URLSearchParams({ decimalLatitude: `${south},${north}`, decimalLongitude: `${west},${east}`, year: '2015,2025', hasCoordinate: 'true', hasGeospatialIssue: 'false', occurrenceStatus: 'PRESENT', limit: '0' })
  for (const basis of ['HUMAN_OBSERVATION', 'MACHINE_OBSERVATION', 'PRESERVED_SPECIMEN']) params.append('basisOfRecord', basis)
  return params
}
async function facet(region, field, taxonKey) {
  const counts = []
  let total = 0
  for (let offset = 0; ; offset += 1000) {
    const params = baseParams(region)
    params.set('facet', field)
    params.set('facetLimit', '1000')
    params.set('facetOffset', String(offset))
    if (taxonKey) params.set('taxonKey', taxonKey)
    const data = await request(`https://api.gbif.org/v1/occurrence/search?${params}`)
    total = data.count
    const page = data.facets?.[0]?.counts || []
    counts.push(...page)
    if (page.length < 1000) break
    if (offset > 99000) throw new Error('Facet limit exceeded; do not publish a truncated count')
  }
  return { counts, total }
}
const classNames = new Map()
function classify(name) {
  if (name === 'Mammalia') return '哺乳动物'
  if (name === 'Aves') return '鸟类'
  if (name === 'Amphibia') return '两栖动物'
  if (name === 'Insecta') return '昆虫'
  if (['Reptilia', 'Squamata', 'Testudines', 'Crocodylia', 'Rhynchocephalia'].includes(name)) return '爬行动物'
  return '其他动物'
}
for (const region of regions) {
  console.log(`Collecting ${region.id}`)
  const all = await facet(region, 'speciesKey')
  region.recordCount = all.total
  region.queryUrl = `https://api.gbif.org/v1/occurrence/search?${baseParams(region)}&facet=speciesKey&facetLimit=1000`
  const sets = Object.fromEntries(groups.map(group => [group, new Set()]))
  for (const [key, group] of [['6', '植物'], ['5', '真菌']]) {
    const result = await facet(region, 'speciesKey', key)
    result.counts.forEach(item => sets[group].add(Number(item.name)))
  }
  const animalClasses = await facet(region, 'classKey', '1')
  for (const cls of animalClasses.counts) {
    if (!classNames.has(cls.name)) {
      const taxon = await request(`https://api.gbif.org/v1/species/${cls.name}`)
      classNames.set(cls.name, taxon.canonicalName || taxon.scientificName)
    }
    const group = classify(classNames.get(cls.name))
    const result = await facet(region, 'speciesKey', cls.name)
    result.counts.forEach(item => sets[group].add(Number(item.name)))
  }
  const animals = await facet(region, 'speciesKey', '1')
  const knownAnimals = new Set(groups.slice(2, 8).flatMap(group => [...sets[group]]))
  animals.counts.forEach(item => { if (!knownAnimals.has(Number(item.name))) sets['其他动物'].add(Number(item.name)) })
  const known = new Set(groups.slice(0, 8).flatMap(group => [...sets[group]]))
  all.counts.forEach(item => { if (!known.has(Number(item.name))) sets['其他生物'].add(Number(item.name)) })
  region.species = Object.fromEntries(groups.map(group => [group, [...sets[group]].sort((a, b) => a - b)]))
  region.counts = Object.fromEntries(groups.map(group => [group, sets[group].size]))
  region.speciesCount = all.counts.length
  const flattened = Object.values(region.species).flat()
  if (flattened.length !== new Set(flattened).size || flattened.length !== region.speciesCount) throw new Error(`Taxonomy overlap or missing species: ${region.id}`)
  console.log(`${region.name}: ${region.speciesCount} species, ${region.recordCount} records`, region.counts)
}
const data = { collectedAt: new Date().toISOString(), years: [2015, 2025], windowKm: 50, groups, regions, taxonomyClasses: Object.fromEntries(classNames), methodology: 'GBIF occurrence API；2015–2025；各中心约50×50km经纬度窗口（并非保护区边界）；存在记录；有坐标且无GBIF地理问题；人工观察、机器观察、保存标本；按speciesKey去重，包含可归属物种的亚种记录。未报告坐标精度的记录未剔除。记录量和物种数受调查力度影响；不是完整物种名录或丰富度排名。', manifest }
await fs.writeFile('public/data/ecology-observations.json', JSON.stringify(data))
await fs.writeFile('data/ecology-evidence/gbif-manifest.json', JSON.stringify(manifest, null, 2))
console.log('Saved public/data/ecology-observations.json')
