import type {
	IHttpRequestMethods,
	INodeProperties,
	INodePropertyOptions,
	INodePropertyRouting,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export const API = 'https://cordhq.app/api/v1';

// `net<N>` = N days of credit. Same list as Cord's payment terms.
const paymentTerms: INodePropertyOptions[] = [
	{ name: 'Net 15', value: 'net15' },
	{ name: 'Net 30', value: 'net30' },
	{ name: 'Net 45', value: 'net45' },
	{ name: 'Net 60', value: 'net60' },
	{ name: 'Net 7', value: 'net7' },
	{ name: 'Net 90', value: 'net90' },
	{ name: 'Upfront', value: 'contado' },
];

type Operation = { name: string; value: string; action: string; method: IHttpRequestMethods; url: string; body?: Record<string, string>; list?: boolean };

// Version 1 returns the response as is ({ data, meta }). Version 2 returns the object itself
// and, in a search, one item per result, as the n8n node guidelines ask.
const routingFor = (o: Operation, version: number): INodePropertyRouting => {
	const request = { method: o.method, url: o.url, ...(o.body ? { body: o.body } : {}) };
	if (version === 1) return { request };
	return {
		request,
		...(o.list
			? { operations: { pagination: { type: 'offset', properties: { limitParameter: 'limit', offsetParameter: 'offset', pageSize: 100, type: 'query' } } } }
			: {}),
		output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
	};
};

const operationProperty = (resource: string, operations: Operation[], version: number): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'create',
	displayOptions: { show: { resource: [resource], '@version': [version] } },
	options: operations.map((o) => ({ name: o.name, value: o.value, action: o.action, routing: routingFor(o, version) })),
});

const listFields = (resource: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: [resource], operation: ['search'], '@version': [2] } },
		routing: { send: { paginate: '={{ $value }}' } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 200 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation: ['search'], returnAll: [false], '@version': [2] } },
		routing: { send: { type: 'query', property: 'limit' } },
	},
];

const clientOperations: Operation[] = [
	{ name: 'Create', value: 'create', action: 'Create a client', method: 'POST', url: '/clientes' },
	{ name: 'Get', value: 'get', action: 'Get a client', method: 'GET', url: '=/clientes/{{$parameter.clientId}}' },
	{ name: 'Search', value: 'search', action: 'Search clients', method: 'GET', url: '/clientes', list: true },
	{ name: 'Update', value: 'update', action: 'Update a client', method: 'PATCH', url: '=/clientes/{{$parameter.clientId}}' },
];

const quoteOperations: Operation[] = [
	{ name: 'Create', value: 'create', action: 'Create a quote', method: 'POST', url: '/cotizaciones' },
	{ name: 'Get', value: 'get', action: 'Get a quote', method: 'GET', url: '=/cotizaciones/{{$parameter.quoteId}}' },
	{ name: 'Mark as Paid', value: 'paid', action: 'Mark a quote as paid', method: 'POST', url: '=/cotizaciones/{{$parameter.quoteId}}', body: { action: 'mark_paid' } },
	{ name: 'Search', value: 'search', action: 'Search quotes', method: 'GET', url: '/cotizaciones', list: true },
	{ name: 'Send', value: 'send', action: 'Send a quote', method: 'POST', url: '=/cotizaciones/{{$parameter.quoteId}}', body: { action: 'send' } },
];

const taskOperations: Operation[] = [{ name: 'Create', value: 'create', action: 'Create a task', method: 'POST', url: '/tareas' }];

const quoteStatuses: INodePropertyOptions[] = [
	{ name: 'Approved', value: 'approved' },
	{ name: 'Draft', value: 'draft' },
	{ name: 'Expired', value: 'expired' },
	{ name: 'Invoiced', value: 'invoiced' },
	{ name: 'Paid', value: 'paid' },
	{ name: 'Rejected', value: 'rejected' },
	{ name: 'Sent', value: 'sent' },
	{ name: 'Viewed', value: 'viewed' },
];

const contactFields = (operation: string, required: boolean): INodeProperties[] => [
	{
		displayName: 'Company',
		name: 'empresa',
		type: 'string',
		default: '',
		required,
		displayOptions: { show: { resource: ['client'], operation: [operation] } },
		routing: { send: { type: 'body', property: 'empresa' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['client'], operation: [operation] } },
		options: [
			{
				displayName: 'Contact',
				name: 'contacto',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'contacto' } },
			},
			{
				displayName: 'Country Code',
				name: 'country_code',
				type: 'string',
				default: '',
				description: 'Two-letter ISO code, for example MX, US or ES',
				routing: { send: { type: 'body', property: 'country_code' } },
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				routing: { send: { type: 'body', property: 'email' } },
			},
			{
				displayName: 'Payment Terms',
				name: 'terminos',
				type: 'options',
				options: paymentTerms,
				default: 'contado',
				routing: { send: { type: 'body', property: 'terminos' } },
			},
			{
				displayName: 'Phone',
				name: 'telefono',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'telefono' } },
			},
			{
				displayName: 'Tax ID',
				name: 'rfc',
				type: 'string',
				default: '',
				description: 'Only for clients invoiced in Mexico',
				routing: { send: { type: 'body', property: 'rfc' } },
			},
		],
	},
];

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		default: 'quote',
		options: [
			{ name: 'Client', value: 'client' },
			{ name: 'Quote', value: 'quote' },
			{ name: 'Task', value: 'task' },
		],
	},

	operationProperty('client', clientOperations, 1),
	operationProperty('client', clientOperations, 2),
	{
		displayName: 'Client ID',
		name: 'clientId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['client'], operation: ['update', 'get'] } },
	},
	...contactFields('create', true),
	...contactFields('update', false),
	{
		displayName: 'Search',
		name: 'q',
		type: 'string',
		default: '',
		description: 'Text or email to look for',
		displayOptions: { show: { resource: ['client'], operation: ['search'] } },
		routing: { send: { type: 'query', property: 'q' } },
	},
	...listFields('client'),

	operationProperty('quote', quoteOperations, 1),
	operationProperty('quote', quoteOperations, 2),
	{
		displayName: 'Quote ID',
		name: 'quoteId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['quote'], operation: ['get', 'send', 'paid'] } },
	},
	{
		displayName: 'Client ID',
		name: 'cliente_id',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'cliente_id' } },
	},
	{
		displayName: 'Items',
		name: 'items',
		placeholder: 'Add Item',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
		options: [
			{
				name: 'item',
				displayName: 'Item',
				values: [
					{ displayName: 'Description', name: 'descripcion', type: 'string', default: '' },
					{ displayName: 'Quantity', name: 'cantidad', type: 'number', default: 1 },
					{ displayName: 'Unit Price', name: 'precio_unitario', type: 'number', default: 0 },
				],
			},
		],
		routing: { send: { type: 'body', property: 'items', value: '={{ $value.item }}' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'quoteAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
		options: [
			{
				displayName: 'Currency',
				name: 'base_currency',
				type: 'string',
				default: '',
				description: 'ISO 4217 code, for example MXN or USD. Empty uses your account currency.',
				routing: { send: { type: 'body', property: 'base_currency' } },
			},
			{
				displayName: 'Notes',
				name: 'notas',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				routing: { send: { type: 'body', property: 'notas' } },
			},
			{
				displayName: 'Payment Terms',
				name: 'terminos',
				type: 'options',
				options: paymentTerms,
				default: 'contado',
				routing: { send: { type: 'body', property: 'terminos' } },
			},
			{
				displayName: 'Send Now',
				name: 'send',
				type: 'boolean',
				default: false,
				description: 'Whether to send the quote to the client right away',
				routing: { send: { type: 'body', property: 'send' } },
			},
			{
				displayName: 'Valid For (Days)',
				name: 'vigencia_dias',
				type: 'number',
				default: 15,
				routing: { send: { type: 'body', property: 'vigencia_dias' } },
			},
		],
	},
	{
		displayName: 'Quote Number',
		name: 'folio',
		type: 'string',
		default: '',
		placeholder: 'e.g. COT-00104',
		description: 'Exact quote number. Leave empty to list every quote.',
		displayOptions: { show: { resource: ['quote'], operation: ['search'] } },
		routing: { send: { type: 'query', property: 'folio' } },
	},
	{
		displayName: 'Filters',
		name: 'quoteFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['quote'], operation: ['search'] } },
		options: [
			{
				displayName: 'Client ID',
				name: 'cliente_id',
				type: 'string',
				default: '',
				routing: { send: { type: 'query', property: 'cliente_id' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: quoteStatuses,
				default: 'sent',
				routing: { send: { type: 'query', property: 'status' } },
			},
		],
	},
	...listFields('quote'),
	{
		displayName: 'Payment Method',
		name: 'payment_method',
		type: 'string',
		default: '',
		description: 'Optional, for example transfer or cash',
		displayOptions: { show: { resource: ['quote'], operation: ['paid'] } },
		routing: { send: { type: 'body', property: 'payment_method' } },
	},

	operationProperty('task', taskOperations, 1),
	operationProperty('task', taskOperations, 2),
	{
		displayName: 'Title',
		name: 'titulo',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'titulo' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'taskAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
		options: [
			{
				displayName: 'Due Date',
				name: 'due_date',
				type: 'dateTime',
				default: '',
				description: 'Only the date is used',
				routing: { send: { type: 'body', property: 'due_date', value: '={{ $value ? String($value).slice(0, 10) : $value }}' } },
			},
			{
				displayName: 'Quote ID',
				name: 'cotizacion_id',
				type: 'string',
				default: '',
				routing: { send: { type: 'body', property: 'cotizacion_id' } },
			},
		],
	},
];

export class Cord implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Cord',
		name: 'cord',
		icon: { light: 'file:cord.svg', dark: 'file:cord.dark.svg' },
		group: ['transform'],
		version: [1, 2],
		defaultVersion: 2,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and manage clients, quotes and tasks in Cord',
		defaults: { name: 'Cord' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'cordApi', required: true }],
		requestDefaults: {
			baseURL: API,
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		},
		properties,
	};
}
