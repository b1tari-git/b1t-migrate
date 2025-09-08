import { app } from '@azure/functions';
import { diffAndStoreFactory } from '../../shared/diffFactory.js';

const handler = diffAndStoreFactory('contact');
app.http('crm-contacts-custom-fields',{ methods:['GET'], authLevel:'anonymous', route:'crm/contacts/custom-fields/get', handler });
