import {
	FEATURE_VIDEO_UPLOADS,
	planHasFeature,
	PLAN_PREMIUM,
	FEATURE_STYLE_CUSTOMIZATION,
} from '@automattic/calypso-products';
import {
	isBlogOnboardingFlow,
	isDesignFirstFlow,
	isNewsletterFlow,
	isStartWritingFlow,
} from '@automattic/onboarding';
import { dispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';
import { translate } from 'i18n-calypso';
import { PLANS_LIST } from 'calypso/../packages/calypso-products/src/plans-list';
import { NavigationControls } from 'calypso/landing/stepper/declarative-flow/internals/types';
import { recordTracksEvent } from 'calypso/lib/analytics/tracks';
import { isVideoPressFlow } from 'calypso/signup/utils';
import { ONBOARD_STORE, SITE_STORE } from '../../../../stores';
import { launchpadFlowTasks } from './tasks';
import { LaunchpadChecklist, LaunchpadStatuses, Task } from './types';
import type { SiteDetails } from '@automattic/data-stores';

/**
 * Some attributes of these enhanced tasks will soon be fetched through a WordPress REST
 * API, making said enhancements here unnecessary ( Ex. title, subtitle, completed,
 * subtitle, badge text, etc. ). This will allow us to access checklist and task information
 * outside of the Calypso client.
 *
 * Please ensure that the enhancements you are adding here are attributes that couldn't be
 * generated in the REST API
 */
export function getEnhancedTasks(
	tasks: Task[] | null | undefined,
	siteSlug: string | null,
	site: SiteDetails | null,
	submit: NavigationControls[ 'submit' ],
	displayGlobalStylesWarning: boolean,
	goToStep?: NavigationControls[ 'goToStep' ],
	flow: string | null = '',
	isEmailVerified = false,
	checklistStatuses: LaunchpadStatuses = {},
	planCartProductSlug?: string | null
) {
	if ( ! tasks ) {
		return [];
	}

	/**
	 * Remove the first_post_published task from the task list if the flow is design-first.
	 * This is temporary until we proper implement the editor flow.
	 */
	if ( isDesignFirstFlow( flow ) ) {
		tasks = tasks.filter( ( task ) => task.id !== 'first_post_published' );
	}

	const enhancedTaskList: Task[] = [];

	const productSlug =
		( isBlogOnboardingFlow( flow ) ? planCartProductSlug : null ) ?? site?.plan?.product_slug;

	const translatedPlanName = productSlug ? PLANS_LIST[ productSlug ].getTitle() : '';

	const setupBlogCompleted =
		Boolean( tasks?.find( ( task ) => task.id === 'setup_blog' )?.completed ) ||
		! isStartWritingFlow( flow );

	const domainUpsellCompleted = isDomainUpsellCompleted( site, checklistStatuses );

	const planCompleted =
		Boolean( tasks?.find( ( task ) => task.id === 'plan_completed' )?.completed ) ||
		! isBlogOnboardingFlow( flow );

	const videoPressUploadCompleted = Boolean(
		tasks?.find( ( task ) => task.id === 'video_uploaded' )?.completed
	);

	const mustVerifyEmailBeforePosting = isNewsletterFlow( flow || null ) && ! isEmailVerified;

	const homePageId = site?.options?.page_on_front;
	// send user to Home page editor, fallback to FSE if page id is not known
	const launchpadUploadVideoLink = homePageId
		? `/page/${ siteSlug }/${ homePageId }`
		: addQueryArgs( `/site-editor/${ siteSlug }`, {
				canvas: 'edit',
		  } );

	const isVideoPressFlowWithUnsupportedPlan =
		isVideoPressFlow( flow ) && ! planHasFeature( productSlug as string, FEATURE_VIDEO_UPLOADS );

	const shouldDisplayWarning = displayGlobalStylesWarning || isVideoPressFlowWithUnsupportedPlan;

	tasks &&
		tasks.map( ( task ) => {
			let taskData = {};
			switch ( task.id ) {
				case 'setup_free':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/setup/free-post-setup/freePostSetup`, {
									siteSlug,
								} )
							);
						},
					};
					break;
				case 'setup_blog':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/setup/${ flow }/setup-blog`, {
									...{ siteSlug: siteSlug },
								} )
							);
						},
						disabled: task.completed,
					};
					break;
				case 'setup_newsletter':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/setup/newsletter-post-setup/newsletterPostSetup`, {
									siteSlug,
								} )
							);
						},
					};
					break;
				case 'design_edited':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/site-editor/${ siteSlug }`, {
									canvas: 'edit',
								} )
							);
						},
					};
					break;
				case 'plan_selected':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							if ( displayGlobalStylesWarning ) {
								recordTracksEvent(
									'calypso_launchpad_global_styles_gating_plan_selected_task_clicked'
								);
							}
							const plansUrl = addQueryArgs( `/plans/${ siteSlug }`, {
								...( shouldDisplayWarning && {
									plan: PLAN_PREMIUM,
									feature: isVideoPressFlowWithUnsupportedPlan
										? FEATURE_VIDEO_UPLOADS
										: FEATURE_STYLE_CUSTOMIZATION,
								} ),
							} );
							window.location.assign( plansUrl );
						},
						completed: task.completed && ! isVideoPressFlowWithUnsupportedPlan,
					};
					break;
				case 'plan_completed':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							const plansUrl = addQueryArgs( `/setup/${ flow }/plans`, {
								...{ siteSlug: siteSlug },
							} );

							window.location.assign( plansUrl );
						},
						badge_text: ! task.completed ? null : translatedPlanName,
						disabled: task.completed || ! domainUpsellCompleted,
					};
					break;
				case 'subscribers_added':
					taskData = {
						actionDispatch: () => {
							if ( goToStep ) {
								recordTaskClickTracksEvent( flow, task.completed, task.id );
								goToStep( 'subscribers' );
							}
						},
					};
					break;
				case 'first_post_published':
					taskData = {
						disabled: mustVerifyEmailBeforePosting || isStartWritingFlow( flow || null ) || false,
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign( `/post/${ siteSlug }` );
						},
					};
					break;
				case 'first_post_published_newsletter':
					taskData = {
						disabled: mustVerifyEmailBeforePosting || false,
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign( `/post/${ siteSlug }` );
						},
					};
					break;
				case 'design_selected':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/setup/update-design/designSetup`, {
									siteSlug,
									flowToReturnTo: flow,
								} )
							);
						},
					};
					break;
				case 'setup_link_in_bio':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/setup/link-in-bio-post-setup/linkInBioPostSetup`, {
									siteSlug,
								} )
							);
						},
					};
					break;
				case 'links_added':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								addQueryArgs( `/site-editor/${ siteSlug }`, {
									canvas: 'edit',
								} )
							);
						},
					};
					break;
				case 'link_in_bio_launched':
					taskData = {
						actionDispatch: () => {
							if ( site?.ID ) {
								const { setPendingAction, setProgressTitle } = dispatch( ONBOARD_STORE );
								const { launchSite } = dispatch( SITE_STORE );

								setPendingAction( async () => {
									setProgressTitle( __( 'Launching Link in bio' ) );
									await launchSite( site.ID );

									// Waits for half a second so that the loading screen doesn't flash away too quickly
									await new Promise( ( res ) => setTimeout( res, 500 ) );
									recordTaskClickTracksEvent( flow, task.completed, task.id );
									return { goToHome: true, siteSlug };
								} );

								submit?.();
							}
						},
					};
					break;
				case 'site_launched':
					taskData = {
						actionDispatch: () => {
							if ( site?.ID ) {
								const { setPendingAction, setProgressTitle } = dispatch( ONBOARD_STORE );
								const { launchSite } = dispatch( SITE_STORE );

								setPendingAction( async () => {
									setProgressTitle( __( 'Launching website' ) );
									await launchSite( site.ID );

									// Waits for half a second so that the loading screen doesn't flash away too quickly
									await new Promise( ( res ) => setTimeout( res, 500 ) );
									recordTaskClickTracksEvent( flow, task.completed, task.id );
									return { goToHome: true, siteSlug };
								} );

								submit?.();
							}
						},
					};
					break;
				case 'blog_launched':
					taskData = {
						disabled:
							isBlogOnboardingFlow( flow ) &&
							( ! planCompleted || ! domainUpsellCompleted || ! setupBlogCompleted ),
						actionDispatch: () => {
							if ( site?.ID ) {
								const { setPendingAction, setProgressTitle } = dispatch( ONBOARD_STORE );
								const { launchSite } = dispatch( SITE_STORE );

								setPendingAction( async () => {
									setProgressTitle( __( 'Launching blog' ) );
									await launchSite( site.ID );

									// Waits for half a second so that the loading screen doesn't flash away too quickly
									await new Promise( ( res ) => setTimeout( res, 500 ) );
									recordTaskClickTracksEvent( flow, task.completed, task.id );
									return { blogLaunched: true, siteSlug };
								} );

								submit?.();
							}
						},
					};
					break;
				case 'videopress_upload':
					taskData = {
						actionUrl: launchpadUploadVideoLink,
						disabled: isVideoPressFlowWithUnsupportedPlan || videoPressUploadCompleted,
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.replace( launchpadUploadVideoLink );
						},
					};
					break;
				case 'videopress_launched':
					taskData = {
						actionDispatch: () => {
							if ( site?.ID ) {
								const { setPendingAction, setProgressTitle } = dispatch( ONBOARD_STORE );
								const { launchSite } = dispatch( SITE_STORE );

								setPendingAction( async () => {
									setProgressTitle( __( 'Launching video site' ) );
									await launchSite( site.ID );

									// Waits for half a second so that the loading screen doesn't flash away too quickly
									await new Promise( ( res ) => setTimeout( res, 500 ) );
									window.location.replace(
										addQueryArgs( `/home/${ siteSlug }`, {
											forceLoadLaunchpadData: true,
										} )
									);
								} );

								submit?.();
							}
						},
					};
					break;
				case 'domain_upsell':
					taskData = {
						completed: domainUpsellCompleted,
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, domainUpsellCompleted, task.id );

							if ( isBlogOnboardingFlow( flow ) ) {
								window.location.assign(
									addQueryArgs( `/setup/${ flow }/domains`, {
										siteSlug,
										flowToReturnTo: flow,
										new: site?.name,
										domainAndPlanPackage: true,
									} )
								);

								return;
							}

							const destinationUrl = domainUpsellCompleted
								? `/domains/manage/${ siteSlug }`
								: addQueryArgs( `/setup/domain-upsell/domains`, {
										siteSlug,
										flowToReturnTo: flow,
										new: site?.name,
								  } );
							window.location.assign( destinationUrl );
						},
						badge_text:
							domainUpsellCompleted || isBlogOnboardingFlow( flow )
								? ''
								: translate( 'Upgrade plan' ),
					};
					break;
				case 'verify_email':
					taskData = {
						completed: isEmailVerified,
					};
					break;
				case 'set_up_payments':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign( `/earn/payments/${ siteSlug }#launchpad` );
						},
					};
					break;
				case 'newsletter_plan_created':
					taskData = {
						actionDispatch: () => {
							recordTaskClickTracksEvent( flow, task.completed, task.id );
							window.location.assign(
								`/earn/payments-plans/${ siteSlug }?launchpad=add-product#add-newsletter-payment-plan`
							);
						},
					};
					break;
			}
			enhancedTaskList.push( { ...task, ...taskData } );
		} );
	return enhancedTaskList;
}

function isDomainUpsellCompleted(
	site: SiteDetails | null,
	checklistStatuses: LaunchpadStatuses
): boolean {
	return ! site?.plan?.is_free || checklistStatuses?.domain_upsell_deferred === true;
}

// Records a generic task click Tracks event
function recordTaskClickTracksEvent(
	flow: string | null | undefined,
	is_completed: boolean,
	task_id: string
) {
	recordTracksEvent( 'calypso_launchpad_task_clicked', {
		task_id,
		is_completed,
		flow,
	} );
}

// Returns list of tasks/checklist items for a specific flow
export function getArrayOfFilteredTasks(
	tasks: Task[],
	flow: string | null,
	isEmailVerified: boolean
) {
	let currentFlowTasksIds = flow ? launchpadFlowTasks[ flow ] : null;

	if ( isEmailVerified && currentFlowTasksIds ) {
		currentFlowTasksIds = currentFlowTasksIds.filter( ( task ) => task !== 'verify_email' );
	}

	return (
		currentFlowTasksIds &&
		currentFlowTasksIds.reduce( ( accumulator, currentTaskId ) => {
			tasks.find( ( task ) => {
				if ( task.id === currentTaskId ) {
					accumulator.push( task );
				}
			} );
			return accumulator;
		}, [] as Task[] )
	);
}

/*
 * Confirms if final task for a given site_intent is completed.
 * This is used to as a fallback check to determine if the full
 * screen launchpad should be shown or not.
 *
 * @param {LaunchpadChecklist} checklist - The list of tasks for a site's launchpad
 * @param {boolean} isSiteLaunched - The value of a site's is_launched option
 * @returns {boolean} - True if the final task for the given site checklist is completed
 */
export function areLaunchpadTasksCompleted(
	checklist: LaunchpadChecklist | null | undefined,
	isSiteLaunched: boolean
) {
	if ( ! checklist || ! Array.isArray( checklist ) ) {
		return false;
	}

	const lastTask = checklist[ checklist.length - 1 ];

	// If last task is site_launched and if site is launched, return true
	// Else return the status of the last task
	if ( lastTask?.id === 'site_launched' && isSiteLaunched ) {
		return true;
	}

	return lastTask?.completed;
}
