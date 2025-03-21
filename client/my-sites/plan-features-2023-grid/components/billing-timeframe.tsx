import {
	isWpComFreePlan,
	isWpcomEnterpriseGridPlan,
	PLAN_BIENNIAL_PERIOD,
	PLAN_ANNUAL_PERIOD,
	PlanSlug,
	getPlanSlugForTermVariant,
	TERM_ANNUALLY,
	isWooExpressPlan,
} from '@automattic/calypso-products';
import { formatCurrency } from '@automattic/format-currency';
import { useIsEnglishLocale } from '@automattic/i18n-utils';
import styled from '@emotion/styled';
import i18n, { localize, TranslateResult, useTranslate } from 'i18n-calypso';
import { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import usePlanPrices from 'calypso/my-sites/plans/hooks/use-plan-prices';
import { getCurrentUserCurrencyCode } from 'calypso/state/currency-code/selectors';

interface Props {
	planName: string;
	billingTimeframe: TranslateResult;
	billingPeriod: number | null | undefined;
	isMonthlyPlan: boolean;
}

function usePerMonthDescription( {
	isMonthlyPlan,
	planName,
	billingPeriod,
}: Omit< Props, 'billingTimeframe' > ) {
	const translate = useTranslate();
	const currencyCode = useSelector( getCurrentUserCurrencyCode );
	const isEnglishLocale = useIsEnglishLocale();
	const planPrices = usePlanPrices( {
		planSlug: planName as PlanSlug,
		returnMonthly: isMonthlyPlan,
	} );
	const planYearlyVariantPricesPerMonth = usePlanPrices( {
		planSlug:
			getPlanSlugForTermVariant( planName as PlanSlug, TERM_ANNUALLY ) ?? ( '' as PlanSlug ),
		returnMonthly: true,
	} );

	if ( isWpComFreePlan( planName ) || isWpcomEnterpriseGridPlan( planName ) ) {
		return null;
	}

	if ( isMonthlyPlan ) {
		// We want `yearlyVariantMaybeDiscountedPricePerMonth` to be the raw price the user
		// would pay if they choose an annual plan instead of the monthly one. So pro-rated
		// (or site-plan specific) credits should not be taken into account.
		const yearlyVariantMaybeDiscountedPricePerMonth =
			planYearlyVariantPricesPerMonth.discountedRawPrice ||
			planYearlyVariantPricesPerMonth.rawPrice;

		if ( yearlyVariantMaybeDiscountedPricePerMonth < planPrices.rawPrice ) {
			return translate( `Save %(discountRate)s%% by paying annually`, {
				args: {
					discountRate: Math.floor(
						( 100 * ( planPrices.rawPrice - yearlyVariantMaybeDiscountedPricePerMonth ) ) /
							planPrices.rawPrice
					),
				},
			} );
		}
	}

	if ( ! isMonthlyPlan ) {
		const discountedPrice = planPrices.planDiscountedRawPrice || planPrices.discountedRawPrice;
		const fullTermDiscountedPriceText =
			currencyCode && discountedPrice
				? formatCurrency( discountedPrice, currencyCode, { stripZeros: true } )
				: null;
		const rawPrice =
			currencyCode && planPrices.rawPrice
				? formatCurrency( planPrices.rawPrice, currencyCode, { stripZeros: true } )
				: null;

		// TODO: Remove check once text is translated
		const displayNewPriceText =
			isEnglishLocale ||
			( i18n.hasTranslation( 'per month, %(rawPrice)s billed annually, Excl. Taxes' ) &&
				i18n.hasTranslation( 'per month, %(rawPrice)s billed every two years, Excl. Taxes' ) &&
				i18n.hasTranslation(
					'per month, {{discount}} %(rawPrice)s billed annually{{/discount}} %(fullTermDiscountedPriceText)s for the first year, Excl. Taxes'
				) &&
				i18n.hasTranslation(
					'per month, {{discount}} %(rawPrice)s billed annually{{/discount}} %(fullTermDiscountedPriceText)s for the first year, Excl. Taxes'
				) );
		if ( fullTermDiscountedPriceText ) {
			if ( PLAN_ANNUAL_PERIOD === billingPeriod ) {
				//per month, $96 billed annually $84 for the first year

				return displayNewPriceText
					? translate(
							'per month, %(fullTermDiscountedPriceText)s for the first year, Excl. Taxes',
							{
								args: { fullTermDiscountedPriceText },
								comment: 'Excl. Taxes is short for excluding taxes',
							}
					  )
					: translate( 'per month, %(fullTermDiscountedPriceText)s for the first year', {
							args: { fullTermDiscountedPriceText },
					  } );
			}

			if ( PLAN_BIENNIAL_PERIOD === billingPeriod ) {
				return displayNewPriceText
					? translate(
							'per month, %(fullTermDiscountedPriceText)s for the first year, Excl. Taxes',
							{
								args: { fullTermDiscountedPriceText, rawPrice },
								comment: 'Excl. Taxes is short for excluding taxes',
							}
					  )
					: translate( 'per month, %(fullTermDiscountedPriceText)s for the first year', {
							args: { fullTermDiscountedPriceText },
					  } );
			}
		} else if ( rawPrice ) {
			if ( PLAN_ANNUAL_PERIOD === billingPeriod ) {
				return displayNewPriceText
					? translate( 'per month, %(rawPrice)s billed annually, Excl. Taxes', {
							args: { rawPrice },
							comment: 'Excl. Taxes is short for excluding taxes',
					  } )
					: translate( 'per month, %(rawPrice)s billed annually', {
							args: { rawPrice },
					  } );
			}

			if ( PLAN_BIENNIAL_PERIOD === billingPeriod ) {
				return displayNewPriceText
					? translate( 'per month, %(rawPrice)s billed every two years, Excl. Taxes', {
							args: { rawPrice },
							comment: 'Excl. Taxes is short for excluding taxes',
					  } )
					: translate( 'per month, %(rawPrice)s billed every two years.', {
							args: { rawPrice },
					  } );
			}
		}
	}

	return null;
}

const DiscountPromotion = styled.div`
	text-transform: uppercase;
	font-weight: 600;
	color: #306e27;
	font-size: $font-body-extra-small;
	margin-top: 6px;
`;

const PlanFeatures2023GridBillingTimeframe: FunctionComponent< Props > = ( props ) => {
	const { planName, billingTimeframe, isMonthlyPlan } = props;
	const translate = useTranslate();
	const perMonthDescription = usePerMonthDescription( props );
	const description = perMonthDescription || billingTimeframe;
	const price = formatCurrency( 25000, 'USD' );

	if ( isWooExpressPlan( planName ) && isMonthlyPlan ) {
		return (
			<div>
				<div>{ billingTimeframe }</div>
				<DiscountPromotion>{ perMonthDescription }</DiscountPromotion>
			</div>
		);
	}

	if ( isWpcomEnterpriseGridPlan( planName ) ) {
		return (
			<div className="plan-features-2023-grid__vip-price">
				{ translate( 'Starts at {{b}}%(price)s{{/b}} yearly', {
					args: { price },
					components: { b: <b /> },
					comment: 'Translators: the price is in US dollars for all users (US$25,000)',
				} ) }
			</div>
		);
	}

	return <div>{ description }</div>;
};

export default localize( PlanFeatures2023GridBillingTimeframe );
