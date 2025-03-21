import { Page } from 'playwright';
import { EditorComponent, envVariables } from '../..';

export type TemplateCategory = 'About';

/**
 * Represents the page template selection modal when first loading a new page in the editor.
 */
export class EditorTemplateModalComponent {
	private page: Page;
	private editor: EditorComponent;

	/**
	 * Constructs an instance of the component.
	 *
	 * @param {Page} page The underlying page.
	 * @param {EditorComponent} editor The EditorComponent instance.
	 */
	constructor( page: Page, editor: EditorComponent ) {
		this.page = page;
		this.editor = editor;
	}

	/**
	 * Select a template category from the sidebar of options.
	 *
	 * @param {TemplateCategory} category Name of the category to select.
	 */
	async selectTemplateCategory( category: TemplateCategory ): Promise< void > {
		const editorParent = await this.editor.parent();
		if ( envVariables.VIEWPORT_NAME === 'mobile' ) {
			await editorParent
				.locator( '.page-pattern-modal__mobile-category-dropdown' )
				.selectOption( category.toLowerCase() );
		} else {
			await editorParent.getByRole( 'menuitem', { name: category, exact: true } ).click();
		}
	}

	/**
	 * Select a template from the grid of options.
	 *
	 * @param {string} label Label for the template (the string underneath the preview).
	 */
	async selectTemplate( label: string ): Promise< void > {
		const editorParent = await this.editor.parent();
		await editorParent.getByRole( 'option', { name: label, exact: true } ).click();
	}

	/**
	 * Select a blank page as your template.
	 */
	async selectBlankPage(): Promise< void > {
		const editorParent = await this.editor.parent();
		await editorParent.getByRole( 'button', { name: 'Blank page' } ).click();
	}
}
