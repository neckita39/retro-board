/**
 * Реэкспорт корневого seo-paths.js — источника правды о том, какие страницы
 * открыты поисковикам. Сам список лежит в корне, потому что его читает ещё и
 * server.js, которому папка src/ в продакшене недоступна (см. Dockerfile).
 */
export { SITE, INDEXABLE_PATHS, CRAWLER_FILES, isIndexable } from '../../seo-paths.js';
