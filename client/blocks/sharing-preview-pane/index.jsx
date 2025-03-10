import { FEATURE_SOCIAL_MASTODON_CONNECTION } from '@automattic/calypso-products';
import { localize } from 'i18n-calypso';
import { get, find, map } from 'lodash';
import PropTypes from 'prop-types';
import { PureComponent } from 'react';
import { connect } from 'react-redux';
import Notice from 'calypso/components/notice';
import NoticeAction from 'calypso/components/notice/notice-action';
import FacebookSharePreview from 'calypso/components/share/facebook-share-preview';
import LinkedinSharePreview from 'calypso/components/share/linkedin-share-preview';
import MastodonSharePreview from 'calypso/components/share/mastodon-share-preview';
import TumblrSharePreview from 'calypso/components/share/tumblr-share-preview';
import TwitterSharePreview from 'calypso/components/share/twitter-share-preview';
import VerticalMenu from 'calypso/components/vertical-menu';
import { SocialItem } from 'calypso/components/vertical-menu/items';
import { decodeEntities } from 'calypso/lib/formatting';
import { getCurrentUserId } from 'calypso/state/current-user/selectors';
import { getSitePost } from 'calypso/state/posts/selectors';
import getSiteIconUrl from 'calypso/state/selectors/get-site-icon-url';
import siteHasFeature from 'calypso/state/selectors/site-has-feature';
import { getSiteUserConnections } from 'calypso/state/sharing/publicize/selectors';
import { getSeoTitle, getSite, getSiteSlug } from 'calypso/state/sites/selectors';
import {
	getPostImage,
	getExcerptForPost,
	getSummaryForPost,
	getPostCustomImage,
	isSocialPost,
} from './utils';

import './style.scss';

const serviceNames = {
	facebook: 'Facebook',
	twitter: 'Twitter',
	linkedin: 'LinkedIn',
	tumblr: 'Tumblr',
	mastodon: 'Mastodon',
};

class SharingPreviewPane extends PureComponent {
	static propTypes = {
		siteId: PropTypes.number,
		postId: PropTypes.number,
		services: PropTypes.array,
		message: PropTypes.string,
		// connected properties
		site: PropTypes.object,
		post: PropTypes.object,
		seoTitle: PropTypes.string,
		selectedService: PropTypes.string,
	};

	static defaultProps = {
		services: Object.keys( serviceNames ),
	};

	constructor( props ) {
		super( props );

		if ( ! props.isMastodonEligible ) {
			const { mastodon, ...rest } = props.services;
			props.services = rest;
		}

		const connectedServices = map( props.connections, 'service' );
		const firstConnectedService = find( props.services, ( service ) => {
			return find( connectedServices, ( connectedService ) => service === connectedService );
		} );
		const selectedService = props.selectedService || firstConnectedService;
		this.state = { selectedService };
	}

	selectPreview = ( selectedService ) => {
		this.setState( { selectedService } );
	};

	renderPreview() {
		const { post, site, message, connections, translate, seoTitle, siteSlug, siteIcon, siteName } =
			this.props;
		const { selectedService } = this.state;

		if ( ! selectedService ) {
			return null;
		}

		const connection = find( connections, { service: selectedService } );

		if ( ! connection ) {
			return (
				<Notice
					text={ translate( 'Connect to %s to see the preview', {
						args: serviceNames[ selectedService ],
					} ) }
					status="is-info"
					showDismiss={ false }
				>
					<NoticeAction href={ '/marketing/connections/' + siteSlug }>
						{ translate( 'Settings' ) }
					</NoticeAction>
				</Notice>
			);
		}

		const articleUrl = get( post, 'URL', '' );
		const articleTitle = get( post, 'title', '' );
		const articleContent = getExcerptForPost( post );
		const articleSummary = getSummaryForPost( post, translate );
		const siteDomain = get( site, 'domain', '' );
		const imageUrl = getPostImage( post );
		const customImage = getPostCustomImage( post );
		const {
			external_name: externalName,
			external_profile_url: externalProfileURL,
			external_profile_picture: externalProfilePicture,
			external_display: externalDisplay,
		} = connection;

		const previewProps = {
			articleUrl,
			articleTitle,
			articleContent,
			articleSummary,
			externalDisplay,
			externalName,
			externalProfileURL,
			externalProfilePicture,
			message,
			imageUrl,
			seoTitle,
			siteDomain,
			siteIcon,
			siteName,
		};

		switch ( selectedService ) {
			case 'facebook':
				return (
					<FacebookSharePreview
						{ ...previewProps }
						articleExcerpt={ post.excerpt }
						articleContent={ post.content }
						customImage={ customImage }
					/>
				);
			case 'tumblr':
				return (
					<TumblrSharePreview
						{ ...previewProps }
						articleContent={ post.content }
						externalProfileURL={ connection.external_profile_URL }
					/>
				);
			case 'linkedin':
				return <LinkedinSharePreview { ...previewProps } />;
			case 'twitter':
				return <TwitterSharePreview { ...previewProps } externalDisplay={ externalDisplay } />;
			case 'mastodon':
				return (
					<MastodonSharePreview
						{ ...previewProps }
						articleExcerpt={ post.excerpt }
						articleContent={ post.content }
						customImage={ customImage }
						isSocialPost={ isSocialPost( post ) }
					/>
				);
			default:
				return null;
		}
	}

	render() {
		const { translate, services } = this.props;
		const initialMenuItemIndex = services.indexOf( this.state.selectedService );

		return (
			<div className="sharing-preview-pane">
				<div className="sharing-preview-pane__sidebar">
					<div className="sharing-preview-pane__explanation">
						<h1 className="sharing-preview-pane__title">{ translate( 'Social Previews' ) }</h1>
						<p className="sharing-preview-pane__description">
							{ translate(
								'This is how your post will appear when people view or share it on any of the networks below'
							) }
						</p>
					</div>
					<VerticalMenu onClick={ this.selectPreview } initialItemIndex={ initialMenuItemIndex }>
						{ services.map( ( service ) => (
							<SocialItem { ...{ key: service, service } } />
						) ) }
					</VerticalMenu>
				</div>
				<div className="sharing-preview-pane__preview-area">
					<div className="sharing-preview-pane__preview">{ this.renderPreview() }</div>
				</div>
			</div>
		);
	}
}

const mapStateToProps = ( state, ownProps ) => {
	const { siteId, postId } = ownProps;
	const site = getSite( state, siteId );
	const post = getSitePost( state, siteId, postId );
	const seoTitle = decodeEntities( getSeoTitle( state, 'posts', { site, post } ) );
	const currentUserId = getCurrentUserId( state );
	const connections = getSiteUserConnections( state, siteId, currentUserId );
	const siteSlug = getSiteSlug( state, siteId );
	const siteIcon = getSiteIconUrl( state, siteId );

	return {
		site,
		post,
		seoTitle,
		connections,
		siteSlug,
		siteIcon,
		siteName: site.name,
		isMastodonEligible: siteHasFeature( state, siteId, FEATURE_SOCIAL_MASTODON_CONNECTION ),
	};
};

export default connect( mapStateToProps )( localize( SharingPreviewPane ) );
