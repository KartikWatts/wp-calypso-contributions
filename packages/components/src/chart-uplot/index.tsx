import { getLocaleSlug, numberFormat, useTranslate } from 'i18n-calypso';
import { useMemo, useState, useRef } from 'react';
import uPlot from 'uplot';
import UplotReact from 'uplot-react';
import useResize from './hooks/use-resize';
import useScaleGradient from './hooks/use-scale-gradient';
import getGradientFill from './lib/get-gradient-fill';

import './style.scss';

// NOTE: Do not include this component in the package entry bundle.
//       Doing so will cause tests of the consumer package to break due to uPlot's reliance on matchMedia.
//       https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom.

const DEFAULT_DIMENSIONS = {
	height: 300,
	width: 1224,
};

interface UplotChartProps {
	data: uPlot.AlignedData;
	fillColor?: string;
	options?: Partial< uPlot.Options >;
	legendContainer?: React.RefObject< HTMLDivElement >;
	solidFill?: boolean;
}

export default function UplotChart( {
	data,
	fillColor = 'rgba(48, 87, 220, 0.4)',
	legendContainer,
	options: propOptions,
	solidFill = false,
}: UplotChartProps ) {
	const translate = useTranslate();
	const uplot = useRef< uPlot | null >( null );
	const uplotContainer = useRef( null );
	const { spline } = uPlot.paths;

	const scaleGradient = useScaleGradient( fillColor );
	const [ options ] = useState< uPlot.Options >(
		useMemo( () => {
			const defaultOptions: uPlot.Options = {
				class: 'calypso-uplot-chart',
				...DEFAULT_DIMENSIONS,
				// Set incoming dates as UTC.
				tzDate: ( ts ) => uPlot.tzDate( new Date( ts * 1e3 ), 'Etc/UTC' ),
				axes: [
					{
						// x-axis
						grid: {
							show: false,
						},
						ticks: {
							stroke: '#646970',
							width: 1,
							size: 3,
						},
					},
					{
						// y-axis
						side: 1,
						gap: 8,
						space: 40,
						size: 50,
						grid: {
							stroke: 'rgba(220, 220, 222, 0.5)', // #DCDCDE with 0.5 opacity
							width: 1,
						},
						ticks: {
							show: false,
						},
					},
				],
				cursor: {
					x: false,
					y: false,
					points: {
						size: ( u, seriesIdx ) => ( u.series[ seriesIdx ].points?.size || 1 ) * 2,
						width: ( u, seriesIdx, size ) => size / 4,
						stroke: ( u, seriesIdx ) => {
							const stroke = u.series[ seriesIdx ]?.points?.stroke;
							return typeof stroke === 'function'
								? ( stroke( u, seriesIdx ) as CanvasRenderingContext2D[ 'strokeStyle' ] )
								: ( stroke as CanvasRenderingContext2D[ 'strokeStyle' ] );
						},
						fill: () => '#fff',
					},
				},
				series: [
					{
						label: translate( 'Date' ),
						value: ( self: uPlot, rawValue: number ) => {
							if ( ! rawValue ) {
								return '-';
							}

							return new Date( rawValue * 1000 ).toLocaleDateString( getLocaleSlug() ?? 'en', {
								month: 'long',
								year: 'numeric',
							} );
						},
					},
					{
						fill: solidFill ? fillColor : getGradientFill( fillColor, scaleGradient ),
						label: translate( 'Subscribers' ),
						stroke: '#3057DC',
						width: 2,
						paths: ( u, seriesIdx, idx0, idx1 ) => {
							return spline?.()( u, seriesIdx, idx0, idx1 ) || null;
						},
						points: {
							show: false,
						},
						value: ( self: uPlot, rawValue: number ) => {
							if ( ! rawValue ) {
								return '-';
							}

							return numberFormat( rawValue, 0 );
						},
					},
				],
				legend: {
					isolate: true,
					mount: ( self: uPlot, el: HTMLElement ) => {
						// If legendContainer is defined, move the legend into it.
						if ( legendContainer?.current ) {
							legendContainer?.current.append( el );
						}
					},
				},
			};
			return {
				...defaultOptions,
				...( typeof propOptions === 'object' ? propOptions : {} ),
			};
		}, [ fillColor, legendContainer, propOptions, scaleGradient, solidFill, spline, translate ] )
	);

	useResize( uplot, uplotContainer );

	return (
		<div className="calypso-uplot-chart-container" ref={ uplotContainer }>
			<UplotReact
				data={ data }
				onCreate={ ( chart ) => ( uplot.current = chart ) }
				options={ options }
			/>
		</div>
	);
}
