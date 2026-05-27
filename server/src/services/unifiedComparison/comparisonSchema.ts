/**
 * JSON Schema for UnifiedComparisonResult validation
 * Used with Gemini 3.5 Flash structured output
 */

import { Type } from "@google/genai";
const SchemaType = Type;

export const UnifiedComparisonSchema = {
  description: "Structured comparison result for insurance quotes",
  type: SchemaType.OBJECT,
  properties: {
    metadata: {
      type: SchemaType.OBJECT,
      properties: {
        generatedAt: { type: SchemaType.STRING },
        model: { type: SchemaType.STRING },
        thinkingLevel: { type: SchemaType.STRING },
        pdfCount: { type: SchemaType.NUMBER },
        totalPages: { type: SchemaType.NUMBER },
        confidence: { type: SchemaType.NUMBER },
        needsHumanReview: { type: SchemaType.BOOLEAN },
        processingTimeMs: { type: SchemaType.NUMBER }
      },
      required: ["generatedAt", "model", "thinkingLevel", "pdfCount", "confidence", "needsHumanReview"]
    },
    client: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        activity: { type: SchemaType.STRING },
        ciiu: { type: SchemaType.STRING, nullable: true },
        address: { type: SchemaType.STRING },
        city: { type: SchemaType.STRING },
        totalInsuredValue: { type: SchemaType.NUMBER }
      },
      required: ["name", "activity", "address", "city", "totalInsuredValue"]
    },
    insurers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quoteDate: { type: SchemaType.STRING },
          validity: { type: SchemaType.STRING },
          product: { type: SchemaType.STRING },
          logo: { type: SchemaType.STRING, nullable: true }
        },
        required: ["name", "quoteDate", "validity", "product"]
      }
    },
    coverageMatrix: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          isExclusive: { type: SchemaType.BOOLEAN, nullable: true },
          rows: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                type: { 
                  type: SchemaType.STRING,
                  enum: ["value", "deductible", "includes", "exclusions", "notes"]
                },
                label: { type: SchemaType.STRING },
                cells: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      value: { type: SchemaType.STRING, nullable: true },
                      rawText: { type: SchemaType.STRING, nullable: true },
                      confidence: { type: SchemaType.NUMBER, nullable: true },
                      pageNumber: { type: SchemaType.NUMBER, nullable: true },
                      isAmbiguous: { type: SchemaType.BOOLEAN, nullable: true },
                      notes: { type: SchemaType.STRING, nullable: true }
                    },
                    required: ["value"]
                  }
                }
              },
              required: ["type", "label", "cells"]
            }
          }
        },
        required: ["category", "rows"]
      }
    },
    financials: {
      type: SchemaType.OBJECT,
      properties: {
        premiums: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              netPremium: { type: SchemaType.NUMBER, nullable: true },
              fees: { type: SchemaType.NUMBER, nullable: true },
              taxes: { type: SchemaType.NUMBER, nullable: true },
              total: { type: SchemaType.NUMBER, nullable: true },
              percentageOfValue: { type: SchemaType.NUMBER, nullable: true }
            },
            required: ["insurer"]
          }
        },
        metadata: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              commission: { type: SchemaType.STRING, nullable: true },
              backing: { type: SchemaType.STRING, nullable: true },
              modality: { type: SchemaType.STRING, nullable: true },
              asistencia: { type: SchemaType.STRING, nullable: true }
            },
            required: ["insurer"]
          }
        }
      },
      required: ["premiums", "metadata"]
    },
    analysis: {
      type: SchemaType.OBJECT,
      properties: {
        bestValue: { type: SchemaType.STRING, nullable: true },
        warnings: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        },
        missingCoverages: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              coverage: { type: SchemaType.STRING }
            },
            required: ["insurer", "coverage"]
          }
        },
        significantDifferences: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              coverage: { type: SchemaType.STRING },
              difference: { type: SchemaType.STRING },
              severity: { 
                type: SchemaType.STRING,
                enum: ["high", "medium", "low"]
              }
            },
            required: ["coverage", "difference", "severity"]
          }
        }
      },
      required: ["warnings", "missingCoverages", "significantDifferences"]
    }
  },
  required: ["metadata", "client", "insurers", "coverageMatrix", "financials", "analysis"]
};
