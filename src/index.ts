// Central aggregator to ensure functions are loaded when host starts.
// Import every function subtree once; side-effect: app.http registrations run.
import './functions/users/custom-fields/index.js';
import './functions/users/extract/index.js';
import './functions/users/get/index.js';
import './functions/users/list/index.js';
import './functions/users/verify/index.js';
import './functions/users/import/index.js';
// (Add further imports as needed for active endpoints)
import './functions/tasks/extract/index.js';
import './functions/tasks/verify/index.js';
import './functions/groups/extract/index.js';
import './functions/groups/verify/index.js';
import './functions/groups/custom-fields/index.js';
import './functions/tasks/custom-fields/index.js';
import './functions/feed/custom-fields/index.js';
import './functions/chats/custom-fields/index.js';
import './functions/workflows/custom-fields/index.js';
import './functions/feed/extract/index.js';
import './functions/feed/verify/index.js';
import './functions/feed/custom-fields/index.js';
import './functions/chats/extract/index.js';
import './functions/chats/verify/index.js';
import './functions/chats/custom-fields/index.js';
import './functions/workflows/extract/index.js';
import './functions/workflows/verify/index.js';
import './functions/workflows/custom-fields/index.js';
import './functions/crm/contacts/extract/index.js';
import './functions/crm/contacts/verify/index.js';
import './functions/crm/contacts/custom-fields/index.js';
import './functions/crm/deals/extract/index.js';
import './functions/crm/deals/verify/index.js';
import './functions/crm/deals/custom-fields/index.js';
import './functions/crm/spitems/extract/index.js';
import './functions/crm/spitems/verify/index.js';
import './functions/crm/spitems/custom-fields/index.js';
