import renderer from "nx/release/changelog-renderer"

export default class ChangelogRenderer extends renderer.default {
	protected override filterChanges(
		changes: renderer.ChangelogChange[],
		project: string | null,
	): renderer.ChangelogChange[] {
		return changes.filter((change) => {
			switch (project) {
				case "solarwinds-apm": {
					return (
						change.affectedProjects === "*" ||
						!change.affectedProjects.every(
							(project) => project === "@solarwinds-apm/instrumentations",
						)
					)
				}
				default: {
					return super.filterChanges(changes, project)
				}
			}
		})
	}

	override shouldRenderAuthors(): boolean {
		return false
	}
}
