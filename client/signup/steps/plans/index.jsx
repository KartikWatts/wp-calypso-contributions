import { is2023PricingGridActivePage, getPlan, PLAN_FREE } from '@automattic/calypso-products';
import { Button } from '@automattic/components';
import { isSiteAssemblerFlow, isTailoredSignupFlow } from '@automattic/onboarding';
import { isDesktop, subscribeIsDesktop } from '@automattic/viewport';
import classNames from 'classnames';
import i18n, { localize } from 'i18n-calypso';
import PropTypes from 'prop-types';
import { parse as parseQs } from 'qs';
import { Component } from 'react';
import { connect } from 'react-redux';
import QueryPlans from 'calypso/components/data/query-plans';
import { LoadingEllipsis } from 'calypso/components/loading-ellipsis';
import MarketingMessage from 'calypso/components/marketing-message';
import Notice from 'calypso/components/notice';
import { getTld, isSubdomain } from 'calypso/lib/domains';
import { ProvideExperimentData } from 'calypso/lib/explat';
import { buildUpgradeFunction } from 'calypso/lib/signup/step-actions';
import wp from 'calypso/lib/wp';
import PlansComparison, {
	isEligibleForProPlan,
	isStarterPlanEnabled,
} from 'calypso/my-sites/plans-comparison';
import PlansFeaturesMain from 'calypso/my-sites/plans-features-main';
import { ExperimentalIntervalTypeToggle } from 'calypso/my-sites/plans-features-main/components/plan-type-selector';
import StepWrapper from 'calypso/signup/step-wrapper';
import { recordTracksEvent } from 'calypso/state/analytics/actions';
import { isTreatmentPlansReorderTest } from 'calypso/state/marketing/selectors';
import { errorNotice } from 'calypso/state/notices/actions';
import { getPlanSlug } from 'calypso/state/plans/selectors';
import hasInitializedSites from 'calypso/state/selectors/has-initialized-sites';
import { saveSignupStep, submitSignupStep } from 'calypso/state/signup/progress/actions';
import { getSiteBySlug } from 'calypso/state/sites/selectors';
import { getDomainName, getIntervalType } from './util';
import './style.scss';

export class PlansStep extends Component {
	state = {
		isDesktop: isDesktop(),
	};

	componentDidMount() {
		this.unsubscribe = subscribeIsDesktop( ( matchesDesktop ) =>
			this.setState( { isDesktop: matchesDesktop } )
		);
		this.props.saveSignupStep( { stepName: this.props.stepName } );

		if ( isTailoredSignupFlow( this.props.flowName ) ) {
			// trigger guides on this step, we don't care about failures or response
			wp.req.post(
				'guides/trigger',
				{
					apiNamespace: 'wpcom/v2/',
				},
				{
					flow: this.props.flowName,
					step: 'plans',
				}
			);
		}
	}

	componentWillUnmount() {
		this.unsubscribe();
	}

	onSelectPlan( cartItem ) {
		buildUpgradeFunction( this.props, cartItem );
	}

	getCustomerType() {
		if ( this.props.customerType ) {
			return this.props.customerType;
		}

		return 'personal';
	}

	replacePaidDomainWithFreeDomain = ( freeDomainSuggestion ) => {
		if ( freeDomainSuggestion?.product_slug ) {
			return;
		}
		const domainItem = undefined;
		const siteUrl = freeDomainSuggestion.domain_name.replace( '.wordpress.com', '' );

		this.props.submitSignupStep(
			{
				stepName: 'domains',
				domainItem,
				isPurchasingItem: false,
				siteUrl,
				stepSectionName: undefined,
			},
			{ domainItem }
		);
	};

	plansFeaturesList() {
		const {
			disableBloggerPlanWithNonBlogDomain,
			hideFreePlan,
			isLaunchPage,
			selectedSite,
			planTypes,
			flowName,
			showTreatmentPlansReorderTest,
			isInVerticalScrollingPlansExperiment,
			isReskinned,
			eligibleForProPlan,
		} = this.props;

		const intervalType = getIntervalType( this.props.path );
		let errorDisplay;
		if ( 'invalid' === this.props.step?.status ) {
			errorDisplay = (
				<div>
					<Notice status="is-error" showDismiss={ false }>
						{ this.props.step.errors.message }
					</Notice>
				</div>
			);
		}

		if ( ! this.props.plansLoaded ) {
			return this.renderLoading();
		}

		if ( eligibleForProPlan ) {
			const selectedDomainConnection =
				this.props.progress?.domains?.domainItem?.product_slug === 'domain_map';
			return (
				<div>
					{ errorDisplay }
					<ExperimentalIntervalTypeToggle
						intervalType={ intervalType }
						isInSignup={ true }
						plans={ [] }
						eligibleForWpcomMonthlyPlans={ true }
					/>
					<PlansComparison
						isInSignup={ true }
						intervalType={ intervalType }
						onSelectPlan={ ( cartItem ) => this.onSelectPlan( cartItem ) }
						selectedSiteId={ selectedSite?.ID || undefined }
						selectedDomainConnection={ selectedDomainConnection }
					/>
				</div>
			);
		}

		const domainName = getDomainName( this.props.signupDependencies.domainItem );

		return (
			<div>
				{ errorDisplay }
				<ProvideExperimentData
					name="calypso_wpcom_onboarding_plans_hide_free_202305"
					options={ { isEligible: 'onboarding' === flowName && !! domainName } }
				>
					{ ( isLoading, experimentAssignment ) => {
						if ( isLoading ) {
							return this.renderLoading();
						}
						return (
							<PlansFeaturesMain
								site={ selectedSite || {} } // `PlanFeaturesMain` expects a default prop of `{}` if no site is provided
								showFAQ={ this.state.isDesktop }
								hideFreePlan={ hideFreePlan || 'treatment' === experimentAssignment?.variationName }
								hideEcommercePlan={ this.shouldHideEcommercePlan() }
								isInSignup={ true }
								isLaunchPage={ isLaunchPage }
								intervalType={ intervalType }
								onUpgradeClick={ ( cartItem ) => this.onSelectPlan( cartItem ) }
								domainName={ domainName }
								customerType={ this.getCustomerType() }
								disableBloggerPlanWithNonBlogDomain={ disableBloggerPlanWithNonBlogDomain }
								plansWithScroll={ this.state.isDesktop }
								planTypes={ planTypes }
								flowName={ flowName }
								showTreatmentPlansReorderTest={ showTreatmentPlansReorderTest }
								isAllPaidPlansShown={ true }
								isInVerticalScrollingPlansExperiment={ isInVerticalScrollingPlansExperiment }
								shouldShowPlansFeatureComparison={ this.state.isDesktop } // Show feature comparison layout in signup flow and desktop resolutions
								isReskinned={ isReskinned }
								hidePremiumPlan={ this.props.hidePremiumPlan }
								hidePersonalPlan={ this.props.hidePersonalPlan }
								hideEnterprisePlan={ this.props.hideEnterprisePlan }
								replacePaidDomainWithFreeDomain={ this.replacePaidDomainWithFreeDomain }
							/>
						);
					} }
				</ProvideExperimentData>
			</div>
		);
	}

	renderLoading() {
		return (
			<div className="plans__loading">
				<LoadingEllipsis active />
			</div>
		);
	}

	getHeaderText() {
		const { headerText, translate, eligibleForProPlan, locale, is2023PricingGridVisible } =
			this.props;

		if ( headerText ) {
			return headerText;
		}

		if ( eligibleForProPlan ) {
			return 'en' === locale || i18n.hasTranslation( 'Choose the right plan for you' )
				? translate( 'Choose the right plan for you' )
				: translate( 'Choose the plan that’s right for you' );
		}

		if ( is2023PricingGridVisible ) {
			return translate( 'Choose your flavor of WordPress' );
		}

		if ( this.state.isDesktop ) {
			return translate( 'Choose a plan' );
		}

		return translate( "Pick a plan that's right for you." );
	}

	getSubHeaderText() {
		const {
			eligibleForProPlan,
			hideFreePlan,
			locale,
			translate,
			useEmailOnboardingSubheader,
			is2023PricingGridVisible,
		} = this.props;

		const freePlanButton = (
			<Button onClick={ () => buildUpgradeFunction( this.props, null ) } borderless />
		);

		if ( eligibleForProPlan ) {
			if ( isStarterPlanEnabled() ) {
				return hideFreePlan
					? translate( 'Try risk-free with a 14-day money-back guarantee.' )
					: translate(
							'Try risk-free with a 14-day money-back guarantee or {{link}}start with a free site{{/link}}.',
							{ components: { link: freePlanButton } }
					  );
			}

			return 'en' === locale ||
				i18n.hasTranslation( 'he WordPress Pro plan comes with a 14-day money back guarantee' )
				? translate( 'The WordPress Pro plan comes with a 14-day money back guarantee' )
				: translate( 'The WordPress Pro plan comes with a 14-day full money back guarantee' );
		}

		if ( useEmailOnboardingSubheader && ! hideFreePlan ) {
			return translate(
				'Add more features to your professional website with a plan. Or {{link}}start with email and a free site{{/link}}.',
				{ components: { link: freePlanButton } }
			);
		}

		if ( is2023PricingGridVisible ) {
			return;
		}

		if ( this.state.isDesktop ) {
			if ( hideFreePlan ) {
				return translate( "Pick one that's right for you and unlock features that help you grow." );
			}

			return translate(
				"Pick one that's right for you and unlock features that help you grow. Or {{link}}start with a free site{{/link}}.",
				{ components: { link: freePlanButton } }
			);
		}

		if ( hideFreePlan ) {
			return translate( 'Choose a plan.' );
		}

		return translate( 'Choose a plan or {{link}}start with a free site{{/link}}.', {
			components: { link: freePlanButton },
		} );
	}

	shouldHideEcommercePlan() {
		// The flow with the Site Assembler step doesn't support atomic site, so we have to hide the plan
		return isSiteAssemblerFlow( this.props.flowName );
	}

	plansFeaturesSelection() {
		const {
			flowName,
			stepName,
			positionInFlow,
			translate,
			hasInitializedSitesBackUrl,
			steps,
			is2023PricingGridVisible,
		} = this.props;

		const headerText = this.getHeaderText();
		const fallbackHeaderText = this.props.fallbackHeaderText || headerText;
		const subHeaderText = this.getSubHeaderText();
		const fallbackSubHeaderText = this.props.fallbackSubHeaderText || subHeaderText;

		let backUrl;
		let backLabelText;

		if ( 0 === positionInFlow && hasInitializedSitesBackUrl ) {
			backUrl = hasInitializedSitesBackUrl;
			backLabelText = translate( 'Back to sites' );
		}

		let queryParams;
		if ( ! isNaN( Number( positionInFlow ) ) && 0 !== positionInFlow ) {
			const previousStepName = steps[ this.props.positionInFlow - 1 ];
			const previousStep = this.props.progress?.[ previousStepName ];

			const isComingFromUseYourDomainStep = 'use-your-domain' === previousStep?.stepSectionName;

			if ( isComingFromUseYourDomainStep ) {
				queryParams = {
					...this.props.queryParams,
					step: 'transfer-or-connect',
					initialQuery: previousStep?.siteUrl,
				};
			}
		}

		return (
			<>
				<StepWrapper
					flowName={ flowName }
					stepName={ stepName }
					positionInFlow={ positionInFlow }
					headerText={ headerText }
					shouldHideNavButtons={ this.props.shouldHideNavButtons }
					fallbackHeaderText={ fallbackHeaderText }
					subHeaderText={ subHeaderText }
					fallbackSubHeaderText={ fallbackSubHeaderText }
					isWideLayout={ ! is2023PricingGridVisible }
					isExtraWideLayout={ is2023PricingGridVisible }
					stepContent={ this.plansFeaturesList() }
					allowBackFirstStep={ !! hasInitializedSitesBackUrl }
					backUrl={ backUrl }
					backLabelText={ backLabelText }
					queryParams={ queryParams }
				/>
			</>
		);
	}

	render() {
		const classes = classNames( 'plans plans-step', {
			'in-vertically-scrolled-plans-experiment':
				! this.props.is2023PricingGridVisible && this.props.isInVerticalScrollingPlansExperiment,
			'has-no-sidebar': true,
			'is-wide-layout': ! this.props.is2023PricingGridVisible,
			'is-extra-wide-layout': this.props.is2023PricingGridVisible,
		} );

		return (
			<>
				<QueryPlans />
				<MarketingMessage path="signup/plans" />
				<div className={ classes }>{ this.plansFeaturesSelection() }</div>
			</>
		);
	}
}

PlansStep.propTypes = {
	additionalStepData: PropTypes.object,
	disableBloggerPlanWithNonBlogDomain: PropTypes.bool,
	goToNextStep: PropTypes.func.isRequired,
	hideFreePlan: PropTypes.bool,
	selectedSite: PropTypes.object,
	stepName: PropTypes.string.isRequired,
	stepSectionName: PropTypes.string,
	customerType: PropTypes.string,
	translate: PropTypes.func.isRequired,
	planTypes: PropTypes.array,
	flowName: PropTypes.string,
	isTreatmentPlansReorderTest: PropTypes.bool,
};

/**
 * Checks if the domainItem picked in the domain step is a top level .blog domain -
 * we only want to make Blogger plan available if it is.
 *
 * @param {Object} domainItem domainItem object stored in the "choose domain" step
 * @returns {boolean} is .blog domain registration
 */
export const isDotBlogDomainRegistration = ( domainItem ) => {
	if ( ! domainItem ) {
		return false;
	}
	const { is_domain_registration, meta } = domainItem;

	return is_domain_registration && getTld( meta ) === 'blog';
};

export default connect(
	(
		state,
		{ path, signupDependencies: { siteSlug, domainItem, plans_reorder_abtest_variation } }
	) => ( {
		// Blogger plan is only available if user chose either a free domain or a .blog domain registration
		disableBloggerPlanWithNonBlogDomain:
			domainItem && ! isSubdomain( domainItem.meta ) && ! isDotBlogDomainRegistration( domainItem ),
		// This step could be used to set up an existing site, in which case
		// some descendants of this component may display discounted prices if
		// they apply to the given site.
		selectedSite: siteSlug ? getSiteBySlug( state, siteSlug ) : null,
		customerType: parseQs( path.split( '?' ).pop() ).customerType,
		hasInitializedSitesBackUrl: hasInitializedSites( state ) ? '/sites/' : false,
		showTreatmentPlansReorderTest:
			'treatment' === plans_reorder_abtest_variation || isTreatmentPlansReorderTest( state ),
		isLoadingExperiment: false,
		// IMPORTANT NOTE: The following is always set to true. It's a hack to resolve the bug reported
		// in https://github.com/Automattic/wp-calypso/issues/50896, till a proper cleanup and deploy of
		// treatment for the `vertical_plan_listing_v2` experiment is implemented.
		isInVerticalScrollingPlansExperiment: true,
		plansLoaded: Boolean( getPlanSlug( state, getPlan( PLAN_FREE )?.getProductId() || 0 ) ),
		eligibleForProPlan: isEligibleForProPlan( state, getSiteBySlug( state, siteSlug )?.ID ),
		is2023PricingGridVisible: is2023PricingGridActivePage( window ),
	} ),
	{ recordTracksEvent, saveSignupStep, submitSignupStep, errorNotice }
)( localize( PlansStep ) );
