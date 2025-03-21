import { useLaunchpad } from '@automattic/data-stores';
import { StepContainer, START_WRITING_FLOW } from '@automattic/onboarding';
import { useSelect, useDispatch as useWPDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { getQueryArg } from '@wordpress/url';
import { useTranslate } from 'i18n-calypso';
import { useSelector, useDispatch } from 'react-redux';
import DocumentHead from 'calypso/components/data/document-head';
import FormattedHeader from 'calypso/components/formatted-header';
import { NavigationControls } from 'calypso/landing/stepper/declarative-flow/internals/types';
import { useRecordSignupComplete } from 'calypso/landing/stepper/hooks/use-record-signup-complete';
import { useSite } from 'calypso/landing/stepper/hooks/use-site';
import { useSiteSlugParam } from 'calypso/landing/stepper/hooks/use-site-slug-param';
import { SITE_STORE } from 'calypso/landing/stepper/stores';
import { recordTracksEvent } from 'calypso/lib/analytics/tracks';
import { isUserLoggedIn } from 'calypso/state/current-user/selectors';
import { successNotice } from 'calypso/state/notices/actions';
import { useQuery } from '../../../../hooks/use-query';
import StepContent from './step-content';
import { areLaunchpadTasksCompleted } from './task-helper';
import type { Step } from '../../types';
import type { SiteSelect } from '@automattic/data-stores';

import './style.scss';

type LaunchpadProps = {
	navigation: NavigationControls;
	flow: string | null;
};

const Launchpad: Step = ( { navigation, flow }: LaunchpadProps ) => {
	const translate = useTranslate();
	const almostReadyToLaunchText = translate( 'Almost ready to launch' );
	const siteSlug = useSiteSlugParam();
	const verifiedParam = useQuery().get( 'verified' );
	const site = useSite();
	const siteIntentOption = site?.options?.site_intent;
	const isSiteLaunched = site?.launch_status === 'launched' || false;
	const {
		isError: launchpadFetchError,
		data: { launchpad_screen: launchpadScreenOption, checklist: launchpadChecklist } = {},
	} = useLaunchpad( siteSlug, siteIntentOption );

	const recordSignupComplete = useRecordSignupComplete( flow );
	const dispatch = useDispatch();
	const { saveSiteSettings } = useWPDispatch( SITE_STORE );
	const isLoggedIn = useSelector( isUserLoggedIn );

	const fetchingSiteError = useSelect(
		( select ) => ( select( SITE_STORE ) as SiteSelect ).getFetchingSiteError(),
		[]
	);

	if ( ! siteSlug || fetchingSiteError?.error || launchpadFetchError ) {
		window.location.replace( '/home' );
	}

	// This is temporary until we can use the launchpad inside the editor.
	const newWriterFlow = 'true' === getQueryArg( window.location.search, START_WRITING_FLOW );

	if (
		! isLoggedIn ||
		launchpadScreenOption === 'off' ||
		( launchpadScreenOption === false && 'videopress' !== flow && ! newWriterFlow )
	) {
		redirectToSiteHome( siteSlug, flow );
	}

	if ( areLaunchpadTasksCompleted( launchpadChecklist, isSiteLaunched ) ) {
		saveSiteSettings( site?.ID, { launchpad_screen: 'off' } );
		redirectToSiteHome( siteSlug, flow );
	}

	function redirectToSiteHome( siteSlug: string | null, flow: string | null ) {
		recordTracksEvent( 'calypso_launchpad_redirect_to_home', { flow: flow } );
		window.location.replace( `/home/${ siteSlug }` );
	}

	useEffect( () => {
		if ( verifiedParam ) {
			const message = translate( 'Email confirmed!' );
			dispatch(
				successNotice( message, {
					duration: 10000,
				} )
			);
		}
	}, [ verifiedParam, translate, dispatch ] );

	useEffect( () => {
		if ( siteSlug && site && localStorage.getItem( 'launchpad_siteSlug' ) !== siteSlug ) {
			recordSignupComplete();
			localStorage.setItem( 'launchpad_siteSlug', siteSlug );
		}
	}, [ recordSignupComplete, siteSlug, site ] );

	return (
		<>
			<DocumentHead title={ almostReadyToLaunchText } />
			<StepContainer
				stepName="launchpad"
				goNext={ navigation.goNext }
				isWideLayout={ true }
				skipLabelText={ translate( 'Skip to dashboard' ) }
				skipButtonAlign="bottom"
				hideBack={ true }
				stepContent={
					<StepContent
						siteSlug={ siteSlug }
						submit={ navigation.submit }
						goNext={ navigation.goNext }
						goToStep={ navigation.goToStep }
						flow={ flow }
					/>
				}
				formattedHeader={
					<FormattedHeader id="launchpad-header" headerText={ <>{ almostReadyToLaunchText }</> } />
				}
				recordTracksEvent={ recordTracksEvent }
			/>
		</>
	);
};

export default Launchpad;
