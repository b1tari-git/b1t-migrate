import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { diffAndStoreFactory } from '../../shared/diffFactory.js';

// Use shared factory for CRM entity deals (deal)
const handler = diffAndStoreFactory('deal');
app.http('crm-deals-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'crm/deals/custom-fields/get', handler });
