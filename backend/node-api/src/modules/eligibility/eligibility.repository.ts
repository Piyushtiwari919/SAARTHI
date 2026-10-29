import { Types } from 'mongoose';
import { OpportunityModel, IOpportunity } from './opportunity.model.js';
import { EligibilityResultModel, IEligibilityResultRecord } from './eligibility-result.model.js';
import { DocumentModel } from '../documents/document.model.js';
import { UserModel } from '../auth/user.model.js';
import { OpportunityRule, UserEvidence } from './eligibility.types.js';

// Default initial seeded opportunities for local development and test stability
export const SEEDED_OPPORTUNITIES: Array<{
  opportunityId: string;
  title: string;
  provider: string;
  description: string;
  rules: OpportunityRule[];
  requiredDocumentTypes: string[];
}> = [
  {
    opportunityId: 'opp_css_01',
    title: 'Central Sector Scheme of Scholarship for College and University Students',
    provider: 'Department of Higher Education, Ministry of Education',
    description: 'Financial assistance to meritorious students from low-income families.',
    rules: [
      {
        ruleId: 'crit_1',
        field: 'percentage',
        operator: 'GTE',
        expectedValue: 80,
        unit: '%',
        required: true,
      },
      {
        ruleId: 'crit_2',
        field: 'annual_family_income',
        operator: 'LTE',
        expectedValue: 450000,
        unit: 'INR',
        required: true,
      },
      {
        ruleId: 'crit_3',
        field: 'course_type',
        operator: 'IN',
        expectedValue: ['Full-time Undergraduate', 'Regular Undergraduate', 'B.Tech', 'Degree'],
        required: true,
      },
    ],
    requiredDocumentTypes: ['MARKSHEET', 'INCOME_CERTIFICATE', 'ADMISSION_LETTER', 'BANK_PASSBOOK'],
  },
  {
    opportunityId: 'opp_aict_02',
    title: 'AICTE Pragati Scholarship Scheme for Girl Students (Technical Degree)',
    provider: 'All India Council for Technical Education (AICTE)',
    description: 'Empowering young women to pursue technical education.',
    rules: [
      {
        ruleId: 'crit_4',
        field: 'gender',
        operator: 'EQ',
        expectedValue: 'Female',
        required: true,
      },
      {
        ruleId: 'crit_5',
        field: 'annual_family_income',
        operator: 'LTE',
        expectedValue: 800000,
        unit: 'INR',
        required: true,
      },
    ],
    requiredDocumentTypes: ['INCOME_CERTIFICATE', 'ADMISSION_LETTER', 'MARKSHEET', 'DOMICILE_CERTIFICATE'],
  },
  {
    opportunityId: 'opp_obc_03',
    title: 'State Post-Matric Scholarship for Other Backward Classes (OBC)',
    provider: 'Directorate of Higher & Technical Education, Maharashtra',
    description: 'Financial support providing tuition fee reimbursement for OBC category students.',
    rules: [
      {
        ruleId: 'crit_6',
        field: 'caste_category',
        operator: 'EQ',
        expectedValue: 'OBC',
        required: true,
      },
      {
        ruleId: 'crit_7',
        field: 'annual_family_income',
        operator: 'LTE',
        expectedValue: 150000,
        unit: 'INR',
        required: true,
      },
      {
        ruleId: 'crit_8',
        field: 'state',
        operator: 'EQ',
        expectedValue: 'Maharashtra',
        required: true,
      },
    ],
    requiredDocumentTypes: ['CASTE_CERTIFICATE', 'INCOME_CERTIFICATE', 'DOMICILE_CERTIFICATE', 'MARKSHEET'],
  },
];

export class EligibilityRepository {
  public async getOpportunityById(opportunityId: string): Promise<IOpportunity | null> {
    const found = await OpportunityModel.findOne({ opportunityId });
    if (found) return found;

    // Check seed fallback
    const seed = SEEDED_OPPORTUNITIES.find((o) => o.opportunityId === opportunityId);
    if (seed) {
      // Lazy seed into DB
      const created = await OpportunityModel.create({
        ...seed,
        isActive: true,
      });
      return created;
    }

    return null;
  }

  public async getAllActiveOpportunities(): Promise<IOpportunity[]> {
    const list = await OpportunityModel.find({ isActive: true });
    if (list.length > 0) return list;

    // Ensure seed opportunities exist
    await Promise.all(
      SEEDED_OPPORTUNITIES.map((seed) =>
        OpportunityModel.updateOne(
          { opportunityId: seed.opportunityId },
          { $setOnInsert: { ...seed, isActive: true } },
          { upsert: true }
        )
      )
    );

    return OpportunityModel.find({ isActive: true });
  }

  public async collectUserEvidence(userId: string): Promise<{
    evidence: UserEvidence[];
    uploadedDocTypes: string[];
  }> {
    const evidence: UserEvidence[] = [];
    const uploadedDocTypes: string[] = [];

    // 1. Fetch user documents
    const documents = await DocumentModel.find({
      ownerId: new Types.ObjectId(userId),
    });

    for (const doc of documents) {
      if (doc.documentType) {
        uploadedDocTypes.push(doc.documentType);
      }

      if (doc.extractedAttributes && doc.extractedAttributes.length > 0) {
        for (const attr of doc.extractedAttributes) {
          // Skip NOT_FOUND, empty, or companion currency fields
          if (
            attr.status === 'NOT_FOUND' ||
            attr.value === null ||
            attr.value === undefined ||
            String(attr.value).trim() === '' ||
            attr.field === 'currency'
          ) {
            continue;
          }

          const sourceDocId = doc.id || doc._id.toString();
          evidence.push({
            field: attr.field,
            value: attr.value,
            confidence: attr.confidence,
            sourceDocumentId: sourceDocId,
            sourcePage: attr.sourcePage,
            evidenceSnippet: attr.evidenceSnippet,
            status: (attr.status as any) || 'EXTRACTED',
            verifiedByUser: attr.verifiedByUser,
          });

          // Map class_xii_percentage to percentage if percentage isn't separately present
          if (attr.field === 'class_xii_percentage') {
            evidence.push({
              field: 'percentage',
              value: attr.value,
              unit: '%',
              confidence: attr.confidence,
              sourceDocumentId: sourceDocId,
              sourcePage: attr.sourcePage,
              evidenceSnippet: attr.evidenceSnippet,
              status: (attr.status as any) || 'EXTRACTED',
              verifiedByUser: attr.verifiedByUser,
            });
          }

          // Map bachelor/undergraduate course to course_type
          if (
            attr.field === 'course' &&
            /bachelor|b\.?\s*tech|undergraduate/i.test(String(attr.value))
          ) {
            evidence.push({
              field: 'course_type',
              value: 'B.Tech',
              confidence: attr.confidence,
              sourceDocumentId: sourceDocId,
              sourcePage: attr.sourcePage,
              evidenceSnippet: attr.evidenceSnippet,
              status: (attr.status as any) || 'EXTRACTED',
              verifiedByUser: attr.verifiedByUser,
            });
          }
        }
      }
    }

    // 2. Fetch user profile data to augment evidence
    const user = await UserModel.findById(userId);
    if (user && user.academicDetails) {
      const {
        annualFamilyIncome,
        gpaOrPercentage,
        category,
        stateOfDomicile,
        course,
      } = user.academicDetails;

      if (annualFamilyIncome !== undefined && annualFamilyIncome !== null) {
        evidence.push({
          field: 'annual_family_income',
          value: annualFamilyIncome,
          unit: 'INR',
          status: 'EXTRACTED',
          verifiedByUser: true,
          evidenceSnippet: 'User Profile: Academic Details Annual Family Income',
        });
      }

      if (gpaOrPercentage !== undefined && gpaOrPercentage !== null) {
        evidence.push({
          field: 'percentage',
          value: gpaOrPercentage,
          unit: '%',
          status: 'EXTRACTED',
          verifiedByUser: true,
          evidenceSnippet: 'User Profile: Academic Score / Percentage',
        });
      }

      if (category) {
        evidence.push({
          field: 'caste_category',
          value: category,
          status: 'EXTRACTED',
          verifiedByUser: true,
          evidenceSnippet: 'User Profile: Reservation Category',
        });
      }

      if (stateOfDomicile) {
        evidence.push({
          field: 'state',
          value: stateOfDomicile,
          status: 'EXTRACTED',
          verifiedByUser: true,
          evidenceSnippet: 'User Profile: State of Domicile',
        });
      }

      if (course) {
        evidence.push({
          field: 'course_type',
          value: course,
          status: 'EXTRACTED',
          verifiedByUser: true,
          evidenceSnippet: 'User Profile: Course Degree',
        });
      }
    }

    return { evidence, uploadedDocTypes };
  }

  public async saveEvaluationResult(
    userId: string,
    result: {
      opportunityId: string;
      opportunityTitle: string;
      overallStatus: string;
      confidenceScore: number;
      summary: string;
      requirements: any[];
      missingDocuments: string[];
      actionItems: any[];
    }
  ): Promise<IEligibilityResultRecord> {
    const saved = await EligibilityResultModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        opportunityId: result.opportunityId,
      },
      {
        $set: {
          opportunityTitle: result.opportunityTitle,
          overallStatus: result.overallStatus,
          confidenceScore: result.confidenceScore,
          summary: result.summary,
          requirements: result.requirements,
          missingDocuments: result.missingDocuments,
          actionItems: result.actionItems,
          evaluatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return saved;
  }

  public async getEvaluationResultsForUser(userId: string): Promise<IEligibilityResultRecord[]> {
    return EligibilityResultModel.find({ userId: new Types.ObjectId(userId) });
  }

  public async getResultByUserAndOpportunity(
    userId: string,
    opportunityId: string
  ): Promise<IEligibilityResultRecord | null> {
    return EligibilityResultModel.findOne({
      userId: new Types.ObjectId(userId),
      opportunityId,
    });
  }

  public async getResultById(resultId: string): Promise<IEligibilityResultRecord | null> {
    if (Types.ObjectId.isValid(resultId)) {
      return EligibilityResultModel.findById(resultId);
    }
    return null;
  }
}

export const eligibilityRepository = new EligibilityRepository();
