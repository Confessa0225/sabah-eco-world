export const animalGroups = ['哺乳动物', '鸟类', '爬行动物', '两栖动物', '昆虫', '其他动物']

export function unionCounts(regions, groups) {
  return Object.fromEntries(groups.map(group => [group, new Set(regions.flatMap(region => region.species[group] || [])).size]))
}

export function csvCounts(data) {
  const rows = [['区域', '生态系统', '国家', '角色', '起始年份', '结束年份', ...data.groups, '已记录物种数', '记录数', '查询链接'],
    ...data.regions.map(r => [r.name, r.ecosystem, r.country, r.role, ...data.years, ...data.groups.map(g => r.counts[g]), r.speciesCount, r.recordCount, r.queryUrl])]
  return '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
}

// Threat values are ordinal categories, never measured percentages.
export function threatLevel(evidence, stage = 'all') {
  const relevant = evidence.filter(item => stage === 'all' || item.stage === stage)
  const graded = relevant.filter(item => Number.isInteger(item.level))
  return graded.length ? Math.max(...graded.map(item => item.level)) : null
}
