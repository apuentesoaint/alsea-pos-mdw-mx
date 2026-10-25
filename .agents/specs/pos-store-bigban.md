# Especificación: Endpoint POS Tienda BigBan y Almacenamiento Idempotente en S3

Estado: Requisito implementado.

## Descripción General
Se ha añadido el endpoint POS `/coupons/pos/store` que permite registrar y subir la información de una tienda BigBan. La información de la tienda se almacena en AWS S3 de forma idempotente tanto individualmente como en un catálogo consolidado.

## Requisitos y Análisis de Payload
- **Atributos Principales**:
  - `countryId` (entero positivo de hasta 2 dígitos): Identificador del país (ej. 1 México, 3 Chile).
  - `brandId` (entero positivo de hasta 2 dígitos): Identificador de la marca/cadena (ej. 10 SBX, 11 BK, 60 CH).
  - `storeId` (entero positivo de hasta 8 dígitos): Identificador de la tienda/sucursal.
  - `name` (cadena opcional): Nombre de la tienda.
  - `posList` / `metadata` / `active` (opcionales): Datos adicionales soportados por la estructura de tienda.
- **Autenticación**: Requiere autorización `Bearer Token` JWT.
- **Formato HTTP**: POST `application/json`.
- **Estructura de Respuesta**: Objeto envuelto bajo el estándar `ApiResponseDTO` de la aplicación:
  ```json
  {
    "uid": "<UUID>",
    "timestamp": "2026-10-25T21:18:34.0000",
    "status": 200,
    "type": "success",
    "message": "Tienda guardada exitosamente.",
    "helpUrl": "/coupons/pos/store",
    "success": true,
    "data": {
      "storeKey": "stores/country_1/brand_11/store_101.json"
    }
  }
  ```

## Estrategia de Idempotencia en S3
1. **Archivo Individual de Tienda**:
   - Clave S3: `stores/country_${countryId}/brand_${brandId}/store_${storeId}.json`
   - En cada llamada para la misma tienda (`countryId-brandId-storeId`), el objeto se sobrescribe exactamente en la misma ruta S3.
2. **Catálogo Consolidado**:
   - Clave S3: `stores/catalog.json`
   - Mantiene la lista de todas las tiendas subidas. Si la tienda ya existe (evaluado por la clave combinada `countryId-brandId-storeId`), se actualiza su registro en el arreglo sin duplicar elementos. Si no existe, se añade al catálogo.

## Archivos de Código Involucrados
- Contratos y validación: `src/core/types.ts`, `src/core/validation.ts`, `src/contracts/openapi.ts`.
- Lógica de persistencia y S3: `src/infrastructure/repository.ts`.
- Lógica de dominio y aplicación HTTP: `src/domain/coupons.ts`, `src/http/application.ts`.
- Configuración Serverless e IAM: `infra/functions.yml`, `infra/resources/iam.yml`.
