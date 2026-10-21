export { fetchProcedures } from '@/features/procedure/api/procedureApi';
export {
  buildProcedureAvailability,
  comingSoonDescription,
  type ProcedureAvailability,
} from '@/features/procedure/availability';
export { useProcedureAvailability } from '@/features/procedure/hooks/useProcedureAvailability';
export { useProcedureMap } from '@/features/procedure/hooks/useProcedureMap';
export { useProcedures } from '@/features/procedure/hooks/useProcedures';
export {
  CATEGORIES,
  CATEGORY_IDS,
  LEGACY_PROCEDURE_ID_ALIASES,
  SUB_PROCEDURES,
  SUB_PROCEDURE_IDS,
  categoryOfProcedure,
  categoryPath,
  categoryPathForProcedure,
  findSubProcedure,
  getCategory,
  getSubProcedure,
  getSubProcedureIdsOf,
  getSubProceduresOf,
  groupProcedureIdsByCategory,
  isCategoryId,
  isProcedureId,
  isSubProcedureId,
  procedureDisplayName,
  resolveLegacyProcedureId,
  searchTaxonomy,
  type CategoryId,
  type ProcedureCategory,
  type ProcedureCategoryGroup,
  type SubProcedure,
  type SubProcedureId,
  type TaxonomyMatch,
} from '@/features/procedure/taxonomy';
