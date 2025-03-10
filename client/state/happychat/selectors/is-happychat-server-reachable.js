import { get } from 'lodash';
import { HAPPYCHAT_CONNECTION_ERROR_PING_TIMEOUT } from 'calypso/state/happychat/constants';

import 'calypso/state/happychat/init';

/**
 * Returns true if Happychat server is reachable
 *
 * @param {Object} state - global redux state
 * @returns {boolean} Whether Happychat server is reachable
 */
export default function ( state ) {
	return get( state, 'happychat.connection.error' ) !== HAPPYCHAT_CONNECTION_ERROR_PING_TIMEOUT;
}
