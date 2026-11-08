// Illustrative images are category-specific; they are not photographs of the reported issue.
export function issueImage(category: string): string {
  switch (category) {
    case 'Roads and Sidewalks': return '/issue-roads.png'
    case 'Graffiti': return '/issue-graffiti.png'
    case 'Garbage and Dumping':
    case 'Litter and Dumping': return '/issue-dumping.png'
    case 'Lighting and Signals': return '/issue-lighting.png'
    default: return '/issue-placeholder.png'
  }
}
