/**
 * Atida Data Foundation capabilities as exposed through the MCP server.
 * Descriptions are what Jev sees as choice criteria, so they are written for disambiguation.
 * TODO: generate from `describe_capability` and pin its `spec_hash`.
 */
export const ENTITIES = ["IB", "IT", "FR"] as const;
export type Entity = (typeof ENTITIES)[number];

export const CAPABILITIES = {
  get_sales_report: "Sales KPIs: revenue, orders, units, AOV, margin over time and by dimension",
  get_trading_day_report: "Today's or a single day's trading snapshot versus targets and last year",
  get_good_sales_report: "Detailed goods sold at SKU or product level",
  get_order_lines: "Raw order lines: individual orders, SKUs, quantities, customers",
  get_price_report:
    "Price intelligence: our price vs competitor min/avg, product profitability, PDP/PLP views",
  get_competitor_prices: "Competitor price observations for a product or brand",
  get_google_shopping: "Google Shopping price and position data",
  get_product_catalog_report: "Catalog coverage: active products, attributes, categories, brands",
  get_catalog_bundles: "Product bundles and packs in the catalog",
  get_sku_oos_report: "Out-of-stock SKUs, stock-outs and availability",
  get_marketing_report: "Marketing performance: traffic, conversion, ROAS by channel and campaign",
  get_marketing_spend: "Marketing spend and budget by channel",
  get_channels_and_funnel_report: "Acquisition channels and conversion funnel steps",
  get_search_report: "On-site search terms, results and zero-result queries",
  get_promos_campaigns: "Promotional campaigns: dates, mechanics, performance",
  get_promos_products: "Products included in promotions and their uplift",
  get_promos_media: "Media assets and placements tied to promotions",
  get_redemptions_report: "Coupon and voucher redemptions",
  get_loyalty_report: "Loyalty program members, points and tiers",
  get_coinvestment_report: "Brand co-investment and trade marketing agreements",
  get_crosselling_report: "Products bought together, cross-sell and basket affinity",
  get_customer_activity: "Customer activity, recency, frequency and churn signals",
  get_customer_brand_report: "Customer behaviour by brand",
  get_customer_product_report: "Customer behaviour by product",
  get_refund_report: "Refunds, returns and their reasons",
  run_druid_query: "Free-form analytical SQL when no report fits",
  none: "Not a data question: chit-chat, how-to, or outside Atida data",
} as const;

export type Capability = keyof typeof CAPABILITIES;
