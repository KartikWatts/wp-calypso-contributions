import { Onboard } from '@automattic/data-stores';
import { BLANK_CANVAS_DESIGN } from '@automattic/design-picker';
import { useFlowProgress, WITH_THEME_ASSEMBLER_FLOW } from '@automattic/onboarding';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect } from 'react';
import { useQuery } from '../hooks/use-query';
import { useSiteSlug } from '../hooks/use-site-slug';
import { ONBOARD_STORE } from '../stores';
import { recordSubmitStep } from './internals/analytics/record-submit-step';
import ErrorStep from './internals/steps-repository/error-step';
import PatternAssembler from './internals/steps-repository/pattern-assembler/lazy';
import ProcessingStep from './internals/steps-repository/processing-step';
import { ProcessingResult } from './internals/steps-repository/processing-step/constants';
import { Flow, ProvidedDependencies } from './internals/types';
import type { OnboardSelect } from '@automattic/data-stores';
import type { Design } from '@automattic/design-picker/src/types';

const SiteIntent = Onboard.SiteIntent;

const withThemeAssemblerFlow: Flow = {
	name: WITH_THEME_ASSEMBLER_FLOW,
	useSideEffect() {
		const { setSelectedDesign, setIntent } = useDispatch( ONBOARD_STORE );
		const selectedTheme = useQuery().get( 'theme' );

		useEffect( () => {
			if ( selectedTheme === BLANK_CANVAS_DESIGN.slug ) {
				// User has selected blank-canvas-3 theme from theme showcase and enter assembler flow
				setSelectedDesign( BLANK_CANVAS_DESIGN as Design );
			}

			setIntent( SiteIntent.WithThemeAssembler );
		}, [] );
	},

	useSteps() {
		return [
			{ slug: 'patternAssembler', component: PatternAssembler },
			{ slug: 'processing', component: ProcessingStep },
			{ slug: 'error', component: ErrorStep },
		];
	},

	useStepNavigation( _currentStep, navigate ) {
		const flowName = this.name;
		const intent = useSelect(
			( select ) => ( select( ONBOARD_STORE ) as OnboardSelect ).getIntent(),
			[]
		);
		const { setStepProgress, setPendingAction } = useDispatch( ONBOARD_STORE );
		const flowProgress = useFlowProgress( { stepName: _currentStep, flowName } );
		setStepProgress( flowProgress );
		const siteSlug = useSiteSlug();

		const exitFlow = ( to: string ) => {
			setPendingAction( () => {
				return new Promise( () => {
					window.location.assign( to );
				} );
			} );

			return navigate( 'processing' );
		};

		const submit = ( providedDependencies: ProvidedDependencies = {}, ...results: string[] ) => {
			recordSubmitStep( providedDependencies, intent, flowName, _currentStep );

			switch ( _currentStep ) {
				case 'processing': {
					if ( results.some( ( result ) => result === ProcessingResult.FAILURE ) ) {
						return navigate( 'error' );
					}

					const params = new URLSearchParams( {
						canvas: 'edit',
						assembler: '1',
					} );

					return exitFlow( `/site-editor/${ siteSlug }?${ params }` );
				}

				case 'patternAssembler': {
					return navigate( 'processing' );
				}
			}
		};

		return { submit };
	},
};

export default withThemeAssemblerFlow;
