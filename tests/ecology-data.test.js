import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { unionCounts, csvCounts, threatLevel } from '../src/ecologyStats.js'

const data = JSON.parse(fs.readFileSync(new URL('../public/data/ecology-observations.json', import.meta.url)))
const threats = JSON.parse(fs.readFileSync(new URL('../public/data/ecology-threats.json', import.meta.url)))

test('published counts match complete cached GBIF species facets, without overlapping groups', () => {
  for (const region of data.regions) {
    const flat = Object.values(region.species).flat()
    assert.equal(new Set(flat).size, flat.length)
    assert.equal(flat.length, region.speciesCount)
    for (const group of data.groups) assert.equal(region.counts[group], region.species[group].length)
    const queries = data.manifest.filter(item => {
      const u = new URL(item.url)
      return u.searchParams.get('decimalLatitude') === `${region.bounds[1]},${region.bounds[3]}` && u.searchParams.get('facet') === 'speciesKey' && !u.searchParams.has('taxonKey')
    }).sort((a, b) => Number(new URL(a.url).searchParams.get('facetOffset')) - Number(new URL(b.url).searchParams.get('facetOffset')))
    assert.ok(queries.length)
    const pages = queries.map(item => JSON.parse(fs.readFileSync(new URL(`../data/ecology-evidence/gbif/${item.file}`, import.meta.url))).data)
    assert.ok(pages.at(-1).facets[0].counts.length < 1000, 'final facet page must not be truncated')
    assert.deepEqual(new Set(pages.flatMap(p => p.facets[0].counts.map(v => Number(v.name)))), new Set(flat))
    assert.equal(pages[0].count, region.recordCount)
  }
})

test('cross-region chart de-duplicates shared species and exported CSV retains source URLs', () => {
  const union = unionCounts(data.regions, data.groups)
  const count = Object.values(union).reduce((a, b) => a + b, 0)
  assert.equal(count, new Set(data.regions.flatMap(r => Object.values(r.species).flat())).size)
  assert.ok(count < data.regions.reduce((a, r) => a + r.speciesCount, 0))
  assert.equal(csvCounts(data).split('\r\n').length, 5)
  assert.ok(csvCounts(data).includes(data.regions[0].queryUrl))
})

test('threat missing values remain unknown and potential/current filters retain original grades', () => {
  assert.equal(threatLevel([]), null)
  assert.equal(threatLevel(threats.rows.serengeti[3]), null)
  assert.equal(threatLevel(threats.rows.sundarbans[1], 'current'), 3)
  assert.equal(threatLevel(threats.rows.sundarbans[1], 'potential'), 4)
  for (const rows of Object.values(threats.rows)) {
    assert.equal(rows.length, 5)
    for (const evidence of rows.flat()) assert.ok([null, 1, 3, 4].includes(evidence.level))
  }
})

test('actual ending function navigates after the transition, only once despite click and timer', () => {
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const fn = main.slice(main.indexOf('function startGameEndTransition()'), main.indexOf('async function startPhaseTwo()'))
  const timers = [], clicks = []
  const context = vm.createContext({ gameEndStarted: false, gamePhase: 'animals', discoveryMessageUntil: 1,
    controls: { isLocked: true, unlock() { this.isLocked = false } },
    discoveryHint: { style: {} }, gameEndOverlay: { style: {}, addEventListener: (_, callback) => clicks.push(callback) },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length }, clearTimeout: () => {},
    location: { href: 'https://example.test/game/index.html' }, URL })
  vm.runInContext(fn + '\nstartGameEndTransition(); startGameEndTransition();', context)
  assert.equal(timers.length, 1)
  assert.equal(timers[0].delay, 5000)
  assert.equal(context.gameEndOverlay.style.display, 'flex')
  assert.equal(context.controls.isLocked, false)
  clicks[0]()
  timers[0].callback()
  assert.equal(timers.length, 2)
  assert.equal(timers[1].delay, 1700)
  timers[1].callback()
  assert.equal(context.location.href, 'https://example.test/game/ecology.html')
})
