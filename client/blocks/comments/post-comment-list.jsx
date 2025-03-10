import { Button, Gridicon } from '@automattic/components';
import classnames from 'classnames';
import { translate } from 'i18n-calypso';
import { get, size, delay } from 'lodash';
import PropTypes from 'prop-types';
import { Component } from 'react';
import { connect } from 'react-redux';
import ConversationFollowButton from 'calypso/blocks/conversation-follow-button';
import { shouldShowConversationFollowButton } from 'calypso/blocks/conversation-follow-button/helper';
import SegmentedControl from 'calypso/components/segmented-control';
import ReaderFollowConversationIcon from 'calypso/reader/components/icons/follow-conversation-icon';
import ReaderFollowingConversationIcon from 'calypso/reader/components/icons/following-conversation-icon';
import { recordAction, recordGaEvent } from 'calypso/reader/stats';
import {
	requestPostComments,
	requestComment,
	setActiveReply,
} from 'calypso/state/comments/actions';
import { NUMBER_OF_COMMENTS_PER_FETCH } from 'calypso/state/comments/constants';
import {
	commentsFetchingStatus,
	getActiveReplyCommentId,
	getCommentById,
	getPostCommentsTree,
} from 'calypso/state/comments/selectors';
import { getCurrentUserId } from 'calypso/state/current-user/selectors';
import { recordReaderTracksEvent } from 'calypso/state/reader/analytics/actions';
import { canCurrentUser } from 'calypso/state/selectors/can-current-user';
import CommentCount from './comment-count';
import PostCommentFormRoot from './form-root';
import PostComment from './post-comment';

import './post-comment-list.scss';

/**
 * PostCommentList displays a list of comments for a post.
 * It has the capability of either starting from the latest comment for a post,
 * or it may begin from any commentId within the post by specifying a commentId.
 *
 * Depending on where the list starts, there is slightly different behavior:
 * 1. from the last comments:
 *    this is the simplest case. Initially onMount we request the latest comments
 *    and only display a subset of them.  When the user clicks "Show More" we load more comments
 *
 * 2. from a specific commentId:
 *    this is activated by specifying the commentId prop. onMount we request the specific comment and then
 *    also a page before it / a page after it.  Then we scroll down to the specific comment.
 *    This also activates a "Show More" button at the end of the comment list instead of just at the top
 *
 */

class PostCommentList extends Component {
	static propTypes = {
		post: PropTypes.shape( {
			ID: PropTypes.number.isRequired,
			site_ID: PropTypes.number.isRequired,
		} ).isRequired,
		pageSize: PropTypes.number,
		initialSize: PropTypes.number,
		showCommentCount: PropTypes.bool,
		startingCommentId: PropTypes.number,
		commentCount: PropTypes.number,
		maxDepth: PropTypes.number,
		showNestingReplyArrow: PropTypes.bool,
		showConversationFollowButton: PropTypes.bool,
		commentsFilter: PropTypes.string,
		followSource: PropTypes.string,

		// To display comments with a different status but not fetch them
		// e.g. Reader full post view showing unapproved comments made to a moderated site
		commentsFilterDisplay: PropTypes.string,

		// connect()ed props:
		commentsTree: PropTypes.object,
		requestPostComments: PropTypes.func.isRequired,
		requestComment: PropTypes.func.isRequired,
		shouldHighlightNew: PropTypes.bool,
	};

	static defaultProps = {
		shouldHighlightNew: false,
		pageSize: NUMBER_OF_COMMENTS_PER_FETCH,
		initialSize: NUMBER_OF_COMMENTS_PER_FETCH,
		showCommentCount: true,
		maxDepth: Infinity,
		showNestingReplyArrow: false,
		showConversationFollowButton: false,
	};

	state = {
		amountOfCommentsToTake: this.props.initialSize,
		commentText: '',
	};

	shouldFetchInitialComment = () => {
		const { startingCommentId, initialComment } = this.props;
		return !! ( startingCommentId && ! initialComment );
	};

	shouldFetchInitialPages = () => {
		const { startingCommentId, commentsTree } = this.props;

		return (
			startingCommentId &&
			commentsTree[ startingCommentId ] &&
			this.props.commentsTree[ startingCommentId ] &&
			! this.alreadyLoadedInitialSet
		);
	};

	shouldNormalFetchAfterPropsChange = () => {
		// this next check essentially looks out for whether we've ever requested comments for the post
		if (
			this.props.commentsFetchingStatus.haveEarlierCommentsToFetch &&
			this.props.commentsFetchingStatus.haveLaterCommentsToFetch
		) {
			return true;
		}

		const currentSiteId = get( this.props, 'post.site_ID' );
		const currentPostId = get( this.props, 'post.ID' );
		const currentCommentsFilter = this.props.commentsFilter;
		const currentInitialComment = this.props.initialComment;

		const nextSiteId = get( this.props, 'post.site_ID' );
		const nextPostId = get( this.props, 'post.ID' );
		const nextCommentsFilter = this.props.commentsFilter;
		const nextInitialComment = this.props.initialComment;

		const propsExist = nextSiteId && nextPostId && nextCommentsFilter;
		const propChanged =
			currentSiteId !== nextSiteId ||
			currentPostId !== nextPostId ||
			currentCommentsFilter !== nextCommentsFilter;

		/**
		 * This covers two cases where fetching by commentId fails and we should fetch as if it werent specified:
		 *  1. the comment specified (commentId) exists for the site but is for a different postId
		 *  2. the commentId does not exist for the site
		 */
		const commentIdBail =
			currentInitialComment !== nextInitialComment &&
			nextInitialComment &&
			( nextInitialComment.error ||
				( nextInitialComment.post && nextInitialComment.post.ID !== nextPostId ) );

		return ( propsExist && propChanged ) || commentIdBail;
	};

	initialFetches = () => {
		const { postId, siteId, commentsFilter: status } = this.props;

		if ( this.shouldFetchInitialComment() ) {
			// there is an edgecase the initialComment can change while on the same post
			// in this case we can't just load the exact comment in question because
			// we could create a gap in the list.
			if ( this.props.commentsTree ) {
				// view earlier...
				this.viewEarlierCommentsHandler();
			} else {
				this.props.requestComment( { siteId, commentId: this.props.startingCommentId } );
			}
		} else if ( this.shouldFetchInitialPages() ) {
			this.viewEarlierCommentsHandler();
			this.viewLaterCommentsHandler();
			this.alreadyLoadedInitialSet = true;
		} else if ( this.shouldNormalFetchAfterPropsChange() ) {
			this.props.requestPostComments( { siteId, postId, status } );
		}
	};

	componentDidMount() {
		this.initialFetches();
		this.scrollWhenDOMReady();
		this.resetActiveReplyComment();
	}

	componentDidUpdate( prevProps, prevState ) {
		// If only the state is changing, do nothing. (Avoids setState loops.)
		if ( prevState !== this.state && prevProps === this.props ) {
			return;
		}
		this.initialFetches();
		if (
			prevProps.siteId !== this.props.siteId ||
			prevProps.postId !== this.props.postId ||
			prevProps.startingCommentId !== this.props.startingCommentId
		) {
			this.hasScrolledToComment = false;
			this.scrollWhenDOMReady();
		}
	}

	commentIsOnDOM = ( commentId ) => !! window.document.getElementById( `comment-${ commentId }` );

	scrollWhenDOMReady = () => {
		if ( this.props.startingCommentId && ! this.hasScrolledToComment ) {
			if ( this.commentIsOnDOM( this.props.startingCommentId ) ) {
				delay( () => this.scrollToComment(), 50 );
			}
			delay( this.scrollWhenDOMReady, 100 );
		}
	};

	renderComment = ( commentId ) => {
		if ( ! commentId ) {
			return null;
		}

		return (
			<PostComment
				post={ this.props.post }
				commentsTree={ this.props.commentsTree }
				commentId={ commentId }
				key={ commentId }
				activeReplyCommentId={ this.props.activeReplyCommentId }
				onReplyClick={ this.onReplyClick }
				onReplyCancel={ this.onReplyCancel }
				commentText={ this.state.commentText }
				onUpdateCommentText={ this.onUpdateCommentText }
				onCommentSubmit={ this.resetActiveReplyComment }
				depth={ 0 }
				maxDepth={ this.props.maxDepth }
				showNestingReplyArrow={ this.props.showNestingReplyArrow }
				shouldHighlightNew={ this.props.shouldHighlightNew }
			/>
		);
	};

	renderCommentManageLink = () => {
		const { siteId, postId } = this.props;

		if ( ! siteId || ! postId ) {
			return null;
		}

		return (
			<Button
				className="comments__manage-comments-button"
				href={ `/comments/all/${ siteId }/${ postId }` }
				borderless
			>
				<Gridicon icon="chat" />
				<span>{ translate( 'Manage comments' ) }</span>
			</Button>
		);
	};

	onReplyClick = ( commentId ) => {
		this.setActiveReplyComment( commentId );
		recordAction( 'comment_reply_click' );
		recordGaEvent( 'Clicked Reply to Comment' );
		this.props.recordReaderTracksEvent( 'calypso_reader_comment_reply_click', {
			blog_id: this.props.post.site_ID,
			comment_id: commentId,
		} );
	};

	onReplyCancel = () => {
		this.setState( { commentText: null } );
		recordAction( 'comment_reply_cancel_click' );
		recordGaEvent( 'Clicked Cancel Reply to Comment' );
		this.props.recordReaderTracksEvent( 'calypso_reader_comment_reply_cancel_click', {
			blog_id: this.props.post.site_ID,
			comment_id: this.props.activeReplyCommentId,
		} );
		this.resetActiveReplyComment();
	};

	onUpdateCommentText = ( commentText ) => {
		this.setState( { commentText: commentText } );
	};

	setActiveReplyComment = ( commentId ) => {
		const siteId = get( this.props, 'post.site_ID' );
		const postId = get( this.props, 'post.ID' );

		if ( ! siteId || ! postId ) {
			return;
		}

		this.props.setActiveReply( {
			siteId,
			postId,
			commentId,
		} );
	};

	resetActiveReplyComment = () => {
		this.setActiveReplyComment( null );
	};

	renderCommentsList = ( commentIds ) => {
		return (
			<ol className="comments__list is-root">
				{ commentIds.map( ( commentId ) => this.renderComment( commentId ) ) }
			</ol>
		);
	};

	scrollToComment = () => {
		const comment = window.document.getElementById( window.location.hash.substring( 1 ) );
		comment.scrollIntoView();
		window.scrollBy( 0, -50 );
		this.hasScrolledToComment = true;
	};

	getCommentsCount = ( commentIds ) => {
		// we always count prevSum, children sum, and +1 for the current processed comment
		return commentIds.reduce(
			( prevSum, commentId ) =>
				prevSum +
				this.getCommentsCount( get( this.props.commentsTree, [ commentId, 'children' ] ) ) +
				1,
			0
		);
	};

	/**
	 * Gets comments for display
	 *
	 * @param {Array<number>} commentIds The top level commentIds to take from
	 * @param {number} numberToTake How many top level comments to take
	 * @returns {Object} that has the displayed comments + total displayed count including children
	 */
	getDisplayedComments = ( commentIds, numberToTake ) => {
		if ( ! commentIds ) {
			return null;
		}

		const displayedComments = numberToTake ? commentIds.slice( numberToTake * -1 ) : [];

		return {
			displayedComments,
			displayedCommentsCount: this.getCommentsCount( displayedComments ),
		};
	};

	viewEarlierCommentsHandler = () => {
		const direction = this.props.commentsFetchingStatus.haveEarlierCommentsToFetch
			? 'before'
			: 'after';
		this.loadMoreCommentsHandler( direction );
	};

	viewLaterCommentsHandler = () => {
		const direction = this.props.commentsFetchingStatus.haveLaterCommentsToFetch
			? 'after'
			: 'before';
		this.loadMoreCommentsHandler( direction );
	};

	loadMoreCommentsHandler = ( direction ) => {
		const {
			post: { ID: postId, site_ID: siteId },
			commentsFilter: status,
		} = this.props;
		const amountOfCommentsToTake = this.state.amountOfCommentsToTake + this.props.pageSize;

		this.setState( { amountOfCommentsToTake } );
		this.props.requestPostComments( { siteId, postId, status, direction } );
	};

	handleFilterClick = ( commentsFilter ) => () => this.props.onFilterChange( commentsFilter );

	render() {
		if ( ! this.props.commentsTree ) {
			return null;
		}

		const {
			post: { ID: postId, site_ID: siteId },
			commentsFilter,
			commentsTree,
			showFilters,
			commentCount,
			followSource,
		} = this.props;
		const { haveEarlierCommentsToFetch, haveLaterCommentsToFetch } =
			this.props.commentsFetchingStatus;

		const amountOfCommentsToTake = this.props.startingCommentId
			? Infinity
			: this.state.amountOfCommentsToTake;

		const { displayedComments, displayedCommentsCount } = this.getDisplayedComments(
			commentsTree.children,
			amountOfCommentsToTake
		);

		// Note: we might show fewer comments than commentsCount because some comments might be
		// orphans (parent deleted/unapproved), that comment will become unreachable but still counted.
		const showViewMoreComments =
			( size( commentsTree.children ) > amountOfCommentsToTake ||
				haveEarlierCommentsToFetch ||
				haveLaterCommentsToFetch ) &&
			displayedCommentsCount > 0;

		// If we're not yet fetched all comments from server, we can only rely on server's count.
		// once we got all the comments tree, we can calculate the count of reachable comments
		const actualCommentsCount =
			haveEarlierCommentsToFetch || haveLaterCommentsToFetch
				? commentCount
				: this.getCommentsCount( commentsTree.children );

		const showConversationFollowButton =
			this.props.showConversationFollowButton &&
			shouldShowConversationFollowButton( this.props.post );

		const showManageCommentsButton = this.props.canUserModerateComments && commentCount > 0;

		return (
			<div
				className={ classnames( 'comments__comment-list', {
					'has-double-actions': showManageCommentsButton && showConversationFollowButton,
				} ) }
			>
				{ ( this.props.showCommentCount || showViewMoreComments ) && (
					<div className="comments__info-bar">
						<div className="comments__info-bar-title-links">
							{ this.props.showCommentCount && <CommentCount count={ actualCommentsCount } /> }
							<div className="comments__actions-wrapper">
								{ showManageCommentsButton && this.renderCommentManageLink() }
								{ showConversationFollowButton && (
									<ConversationFollowButton
										className="comments__conversation-follow-button"
										siteId={ siteId }
										postId={ postId }
										post={ this.props.post }
										followSource={ followSource }
										followIcon={ ReaderFollowConversationIcon( { iconSize: 20 } ) }
										followingIcon={ ReaderFollowingConversationIcon( { iconSize: 20 } ) }
									/>
								) }
							</div>
						</div>
						{ showViewMoreComments && (
							<button className="comments__view-more" onClick={ this.viewEarlierCommentsHandler }>
								{ translate( 'Load more comments (Showing %(shown)d of %(total)d)', {
									args: {
										shown: displayedCommentsCount,
										total: actualCommentsCount,
									},
								} ) }
							</button>
						) }
					</div>
				) }
				{ showFilters && (
					<SegmentedControl compact primary>
						<SegmentedControl.Item
							selected={ commentsFilter === 'all' }
							onClick={ this.handleFilterClick( 'all' ) }
						>
							{ translate( 'All' ) }
						</SegmentedControl.Item>
						<SegmentedControl.Item
							selected={ commentsFilter === 'approved' }
							onClick={ this.handleFilterClick( 'approved' ) }
						>
							{ translate( 'Approved', { context: 'comment status' } ) }
						</SegmentedControl.Item>
						<SegmentedControl.Item
							selected={ commentsFilter === 'unapproved' }
							onClick={ this.handleFilterClick( 'unapproved' ) }
						>
							{ translate( 'Pending', { context: 'comment status' } ) }
						</SegmentedControl.Item>
						<SegmentedControl.Item
							selected={ commentsFilter === 'spam' }
							onClick={ this.handleFilterClick( 'spam' ) }
						>
							{ translate( 'Spam', { context: 'comment status' } ) }
						</SegmentedControl.Item>
						<SegmentedControl.Item
							selected={ commentsFilter === 'trash' }
							onClick={ this.handleFilterClick( 'trash' ) }
						>
							{ translate( 'Trash', { context: 'comment status' } ) }
						</SegmentedControl.Item>
					</SegmentedControl>
				) }
				{ this.renderCommentsList( displayedComments ) }
				{ showViewMoreComments && this.props.startingCommentId && (
					<button className="comments__view-more" onClick={ this.viewLaterCommentsHandler }>
						{ translate( 'Load more comments (Showing %(shown)d of %(total)d)', {
							args: {
								shown: displayedCommentsCount,
								total: actualCommentsCount,
							},
						} ) }
					</button>
				) }
				<PostCommentFormRoot
					post={ this.props.post }
					commentsTree={ this.props.commentsTree }
					commentText={ this.state.commentText }
					onUpdateCommentText={ this.onUpdateCommentText }
					activeReplyCommentId={ this.props.activeReplyCommentId }
				/>
			</div>
		);
	}
}

export default connect(
	( state, ownProps ) => {
		const authorId = getCurrentUserId( state );
		const siteId = ownProps.post.site_ID;
		const postId = ownProps.post.ID;

		return {
			siteId,
			postId,
			canUserModerateComments: canCurrentUser( state, siteId, 'moderate_comments' ),
			commentsTree: getPostCommentsTree(
				state,
				siteId,
				postId,
				ownProps.commentsFilterDisplay ? ownProps.commentsFilterDisplay : ownProps.commentsFilter,
				authorId
			),
			commentsFetchingStatus: commentsFetchingStatus(
				state,
				siteId,
				postId,
				ownProps.commentCount
			),
			initialComment: getCommentById( {
				state,
				siteId,
				commentId: ownProps.startingCommentId,
			} ),
			activeReplyCommentId: getActiveReplyCommentId( {
				state,
				siteId,
				postId,
			} ),
		};
	},
	{ requestComment, requestPostComments, recordReaderTracksEvent, setActiveReply }
)( PostCommentList );
