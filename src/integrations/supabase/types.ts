export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          label: string
          school_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          label: string
          school_id?: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          label?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          class_id: string | null
          created_at: string
          id: string
          minutes_late: number | null
          reason: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          attendance_date?: string
          class_id?: string | null
          created_at?: string
          id?: string
          minutes_late?: number | null
          reason?: string | null
          recorded_by?: string | null
          school_id?: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          attendance_date?: string
          class_id?: string | null
          created_at?: string
          id?: string
          minutes_late?: number | null
          reason?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_school_id_class_id_fkey"
            columns: ["school_id", "class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
          school_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
          school_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_notes: {
        Row: {
          class_avg: number | null
          composition: number | null
          created_at: string
          id: string
          school_id: string
          student_id: string
          subject_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          class_avg?: number | null
          composition?: number | null
          created_at?: string
          id?: string
          school_id?: string
          student_id: string
          subject_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          class_avg?: number | null
          composition?: number | null
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
          subject_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_notes_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "bulletin_notes_school_id_subject_id_fkey"
            columns: ["school_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "bulletin_notes_school_id_term_id_fkey"
            columns: ["school_id", "term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      bulletin_remarks: {
        Row: {
          absences: string | null
          blame: string | null
          congratulations: string | null
          created_at: string
          decision: string | null
          encouragement: string | null
          honor_roll: string | null
          id: string
          observation: string | null
          retards: string | null
          school_id: string
          student_id: string
          term_id: string
          updated_at: string
          warning: string | null
        }
        Insert: {
          absences?: string | null
          blame?: string | null
          congratulations?: string | null
          created_at?: string
          decision?: string | null
          encouragement?: string | null
          honor_roll?: string | null
          id?: string
          observation?: string | null
          retards?: string | null
          school_id?: string
          student_id: string
          term_id: string
          updated_at?: string
          warning?: string | null
        }
        Update: {
          absences?: string | null
          blame?: string | null
          congratulations?: string | null
          created_at?: string
          decision?: string | null
          encouragement?: string | null
          honor_roll?: string | null
          id?: string
          observation?: string | null
          retards?: string | null
          school_id?: string
          student_id?: string
          term_id?: string
          updated_at?: string
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_remarks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_remarks_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "bulletin_remarks_school_id_term_id_fkey"
            columns: ["school_id", "term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          coefficient: number
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number
          id?: string
          school_id?: string
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_school_id_class_id_fkey"
            columns: ["school_id", "class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_subject_id_fkey"
            columns: ["school_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          capacity: number | null
          created_at: string
          id: string
          is_archived: boolean
          level_id: string
          main_teacher_id: string | null
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          capacity?: number | null
          created_at?: string
          id?: string
          is_archived?: boolean
          level_id: string
          main_teacher_id?: string | null
          name: string
          school_id?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          capacity?: number | null
          created_at?: string
          id?: string
          is_archived?: boolean
          level_id?: string
          main_teacher_id?: string | null
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_academic_year_id_fkey"
            columns: ["school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_level_id_fkey"
            columns: ["school_id", "level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "classes_school_id_main_teacher_id_fkey"
            columns: ["school_id", "main_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      education_levels: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          name: string
          order_index: number
          school_id: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          name: string
          order_index?: number
          school_id?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          name?: string
          order_index?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_levels_school_id_cycle_id_fkey"
            columns: ["school_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "school_cycles"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "education_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          class_id: string
          created_at: string
          eval_date: string
          id: string
          kind: string
          max_score: number
          rank: number
          school_id: string
          subject_id: string
          term_id: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          eval_date?: string
          id?: string
          kind?: string
          max_score?: number
          rank?: number
          school_id?: string
          subject_id: string
          term_id: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          eval_date?: string
          id?: string
          kind?: string
          max_score?: number
          rank?: number
          school_id?: string
          subject_id?: string
          term_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_school_id_class_id_fkey"
            columns: ["school_id", "class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_school_id_subject_id_fkey"
            columns: ["school_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "evaluations_school_id_term_id_fkey"
            columns: ["school_id", "term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          label: string | null
          school_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          label?: string | null
          school_id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          label?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_adjustment_effects: {
        Row: {
          adjustment_id: string
          created_row: boolean
          delta: number
          id: string
          school_id: string
          student_fee_id: string
        }
        Insert: {
          adjustment_id: string
          created_row?: boolean
          delta: number
          id?: string
          school_id?: string
          student_fee_id: string
        }
        Update: {
          adjustment_id?: string
          created_row?: boolean
          delta?: number
          id?: string
          school_id?: string
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustment_effects_school_id_adjustment_id_fkey"
            columns: ["school_id", "adjustment_id"]
            isOneToOne: false
            referencedRelation: "fee_adjustments"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "fee_adjustment_effects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustment_effects_school_id_student_fee_id_fkey"
            columns: ["school_id", "student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      fee_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label?: string | null
          school_id?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustments_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          paid_at: string
          receipt_number: string | null
          recorded_by: string | null
          school_id: string
          student_fee_id: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string
          student_fee_id?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string
          student_fee_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_student_fee_id_fkey"
            columns: ["school_id", "student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      grades: {
        Row: {
          comment: string | null
          created_at: string
          evaluation_id: string
          id: string
          school_id: string
          score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          school_id?: string
          score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          school_id?: string
          score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_school_id_evaluation_id_fkey"
            columns: ["school_id", "evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          income_date: string
          label: string | null
          school_id: string
          student_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          income_date?: string
          label?: string | null
          school_id?: string
          student_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          income_date?: string
          label?: string | null
          school_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incomes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      member_cycles: {
        Row: {
          cycle_id: string
          member_id: string
          school_id: string
        }
        Insert: {
          cycle_id: string
          member_id: string
          school_id: string
        }
        Update: {
          cycle_id?: string
          member_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_cycles_school_id_cycle_id_fkey"
            columns: ["school_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "school_cycles"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "member_cycles_school_id_member_id_fkey"
            columns: ["school_id", "member_id"]
            isOneToOne: false
            referencedRelation: "school_members"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      parents: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          profession: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          profession?: string | null
          school_id?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          profession?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_deletions: {
        Row: {
          amount: number
          deleted_at: string
          deleted_by: string | null
          id: string
          method: string | null
          note: string | null
          paid_at: string | null
          payment_id: string
          receipt_number: string | null
          school_id: string
          student_id: string | null
          student_name: string | null
        }
        Insert: {
          amount: number
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          payment_id: string
          receipt_number?: string | null
          school_id?: string
          student_id?: string | null
          student_name?: string | null
        }
        Update: {
          amount?: number
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          payment_id?: string
          receipt_number?: string | null
          school_id?: string
          student_id?: string | null
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_deletions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      primary_scores: {
        Row: {
          id: string
          month_key: string
          school_id: string
          score: number | null
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          month_key: string
          school_id?: string
          score?: number | null
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          month_key?: string
          school_id?: string
          score?: number | null
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_scores_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "primary_scores_school_id_subject_id_fkey"
            columns: ["school_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "primary_subjects"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      primary_subjects: {
        Row: {
          block: string
          coefficient: number
          created_at: string
          grp: string
          id: string
          is_active: boolean
          max_points: number
          name: string
          order_index: number
          school_id: string
        }
        Insert: {
          block: string
          coefficient?: number
          created_at?: string
          grp: string
          id?: string
          is_active?: boolean
          max_points?: number
          name: string
          order_index?: number
          school_id?: string
        }
        Update: {
          block?: string
          coefficient?: number
          created_at?: string
          grp?: string
          id?: string
          is_active?: boolean
          max_points?: number
          name?: string
          order_index?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_cards: {
        Row: {
          appreciation: string | null
          general_average: number | null
          generated_at: string | null
          id: string
          school_id: string
          student_id: string
          term_id: string
        }
        Insert: {
          appreciation?: string | null
          general_average?: number | null
          generated_at?: string | null
          id?: string
          school_id?: string
          student_id: string
          term_id: string
        }
        Update: {
          appreciation?: string | null
          general_average?: number | null
          generated_at?: string | null
          id?: string
          school_id?: string
          student_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "report_cards_school_id_term_id_fkey"
            columns: ["school_id", "term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      school_cycles: {
        Row: {
          code: string
          created_at: string
          grading_system: string
          id: string
          name: string
          order_index: number
          school_id: string
        }
        Insert: {
          code: string
          created_at?: string
          grading_system?: string
          id?: string
          name: string
          order_index?: number
          school_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          grading_system?: string
          id?: string
          name?: string
          order_index?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_cycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_fees: {
        Row: {
          academic_year_id: string
          amount: number
          created_at: string
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["fee_kind"]
          level_id: string | null
          name: string
          order_index: number
          school_id: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["fee_kind"]
          level_id?: string | null
          name: string
          order_index?: number
          school_id?: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["fee_kind"]
          level_id?: string | null
          name?: string
          order_index?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_fees_school_id_academic_year_id_fkey"
            columns: ["school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "school_fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_fees_school_id_level_id_fkey"
            columns: ["school_id", "level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      school_members: {
        Row: {
          created_at: string
          id: string
          is_supervisor: boolean
          role: Database["public"]["Enums"]["school_role"]
          school_id: string
          status: string
          teacher_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_supervisor?: boolean
          role: Database["public"]["Enums"]["school_role"]
          school_id: string
          status?: string
          teacher_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_supervisor?: boolean
          role?: Database["public"]["Enums"]["school_role"]
          school_id?: string
          status?: string
          teacher_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      schools: {
        Row: {
          absence_threshold: number
          accent_color: string | null
          address: string | null
          city: string | null
          country: string
          created_at: string
          currency: string
          current_academic_year_id: string | null
          email: string | null
          header_lines: Json
          id: string
          logo_path: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secretary_can_collect: boolean
          settings: Json
          short_name: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          absence_threshold?: number
          accent_color?: string | null
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          current_academic_year_id?: string | null
          email?: string | null
          header_lines?: Json
          id?: string
          logo_path?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secretary_can_collect?: boolean
          settings?: Json
          short_name?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          absence_threshold?: number
          accent_color?: string | null
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          current_academic_year_id?: string | null
          email?: string | null
          header_lines?: Json
          id?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secretary_can_collect?: boolean
          settings?: Json
          short_name?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_id_current_academic_year_id_fkey"
            columns: ["id", "current_academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount_due: number
          due_date: string | null
          id: string
          school_fee_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          amount_due: number
          due_date?: string | null
          id?: string
          school_fee_id: string
          school_id?: string
          student_id: string
        }
        Update: {
          amount_due?: number
          due_date?: string | null
          id?: string
          school_fee_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_school_id_school_fee_id_fkey"
            columns: ["school_id", "school_fee_id"]
            isOneToOne: false
            referencedRelation: "school_fees"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "student_fees_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      student_parents: {
        Row: {
          id: string
          is_primary: boolean
          parent_id: string
          relationship: string
          school_id: string
          student_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          parent_id: string
          relationship?: string
          school_id?: string
          student_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean
          parent_id?: string
          relationship?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_school_id_parent_id_fkey"
            columns: ["school_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "student_parents_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year_id: string
          address: string | null
          birth_date: string | null
          birth_place: string | null
          class_id: string | null
          created_at: string
          emergency_contact: string | null
          emergency_phone: string | null
          enrollment_date: string
          fee_discount: number
          fee_note: string | null
          fee_status: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          health_notes: string | null
          id: string
          last_name: string
          matricule: string
          nationality: string | null
          notes: string | null
          phone: string | null
          photo_path: string | null
          previous_class: string | null
          previous_school: string | null
          school_id: string
          siblings: string | null
          status: Database["public"]["Enums"]["student_status"]
          student_type: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          enrollment_date?: string
          fee_discount?: number
          fee_note?: string | null
          fee_status?: string
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          health_notes?: string | null
          id?: string
          last_name: string
          matricule: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          previous_class?: string | null
          previous_school?: string | null
          school_id?: string
          siblings?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_type?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          class_id?: string | null
          created_at?: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          enrollment_date?: string
          fee_discount?: number
          fee_note?: string | null
          fee_status?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          health_notes?: string | null
          id?: string
          last_name?: string
          matricule?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          previous_class?: string | null
          previous_school?: string | null
          school_id?: string
          siblings?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_academic_year_id_fkey"
            columns: ["school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "students_school_id_class_id_fkey"
            columns: ["school_id", "class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          default_coefficient: number
          groupe: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          code: string
          created_at?: string
          default_coefficient?: number
          groupe?: string | null
          id?: string
          name: string
          school_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_coefficient?: number
          groupe?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          id: string
          school_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          id?: string
          school_id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_school_id_subject_id_fkey"
            columns: ["school_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "teacher_subjects_school_id_teacher_id_fkey"
            columns: ["school_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          hire_date: string | null
          id: string
          last_name: string
          phone: string | null
          school_id: string
          status: Database["public"]["Enums"]["teacher_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          last_name: string
          phone?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["teacher_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          phone?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["teacher_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string
          end_date: string
          id: string
          name: string
          order_index: number
          school_id: string
          start_date: string
        }
        Insert: {
          academic_year_id: string
          end_date: string
          id?: string
          name: string
          order_index?: number
          school_id?: string
          start_date: string
        }
        Update: {
          academic_year_id?: string
          end_date?: string
          id?: string
          name?: string
          order_index?: number
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_school_id_academic_year_id_fkey"
            columns: ["school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deposit_date: string
          id: string
          note: string | null
          school_id: string
          settled_at: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deposit_date?: string
          id?: string
          note?: string | null
          school_id?: string
          settled_at?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deposit_date?: string
          id?: string
          note?: string | null
          school_id?: string
          settled_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_deposits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_deposits_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acad_admin_class: { Args: { cid: string; sid: string }; Returns: boolean }
      acad_admin_student: {
        Args: { sid: string; stid: string }
        Returns: boolean
      }
      add_fee_adjustment: {
        Args: {
          _amount: number
          _kind: string
          _label?: string
          _student_id: string
        }
        Returns: string
      }
      adjustment_student_ok: {
        Args: { adj: string; sid: string }
        Returns: boolean
      }
      admin_add_member: {
        Args: {
          p_cycle_codes?: string[]
          p_role: Database["public"]["Enums"]["school_role"]
          p_school: string
          p_supervisor?: boolean
          p_teacher?: string
          p_user: string
        }
        Returns: string
      }
      admin_list_members: {
        Args: { p_school: string }
        Returns: {
          cycles: string[]
          email: string
          full_name: string
          is_supervisor: boolean
          role: Database["public"]["Enums"]["school_role"]
          status: string
          user_id: string
        }[]
      }
      admin_list_schools: {
        Args: never
        Returns: {
          city: string
          created_at: string
          id: string
          members: number
          name: string
          slug: string
          status: string
        }[]
      }
      admin_set_member_status: {
        Args: { p_school: string; p_status: string; p_user: string }
        Returns: undefined
      }
      admin_set_school_status: {
        Args: { p_school: string; p_status: string }
        Returns: undefined
      }
      assign_student_fees: {
        Args: { _include_inscription?: boolean; _student_id: string }
        Returns: number
      }
      att_ok: { Args: { sid: string; stid: string }; Returns: boolean }
      can_edit_sensitive: { Args: { sid: string }; Returns: boolean }
      can_enroll: { Args: { sid: string }; Returns: boolean }
      class_cycle: { Args: { cid: string; sid: string }; Returns: string }
      create_school: {
        Args: { p_cycles?: Json; p_name: string; p_slug: string }
        Returns: string
      }
      cycle_scope_ok: { Args: { cyc: string; sid: string }; Returns: boolean }
      default_school_id: { Args: never; Returns: string }
      eval_ok: { Args: { eid: string; sid: string }; Returns: boolean }
      finance_editor: { Args: { sid: string }; Returns: boolean }
      finance_viewer: { Args: { sid: string }; Returns: boolean }
      founder_sees_user: { Args: { uid: string }; Returns: boolean }
      is_founder: { Args: { sid: string }; Returns: boolean }
      is_main_teacher: { Args: { sid: string; stid: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_supervisor: { Args: { sid: string }; Returns: boolean }
      level_cycle: { Args: { lid: string; sid: string }; Returns: string }
      manage_structure: { Args: { sid: string }; Returns: boolean }
      member_schools: { Args: never; Returns: string[] }
      my_memberships: {
        Args: never
        Returns: {
          cycle_ids: string[]
          is_supervisor: boolean
          role: Database["public"]["Enums"]["school_role"]
          school: Json
          school_id: string
          teacher_id: string
        }[]
      }
      my_schools: { Args: never; Returns: string[] }
      my_teacher_id: { Args: { sid: string }; Returns: string }
      primary_ok: {
        Args: { sid: string; stid: string; write_access: boolean }
        Returns: boolean
      }
      remove_fee_adjustment: {
        Args: { _adjustment_id: string }
        Returns: undefined
      }
      requested_school_raw: { Args: never; Returns: string }
      role_in: {
        Args: { sid: string }
        Returns: Database["public"]["Enums"]["school_role"]
      }
      sees_class: { Args: { cid: string; sid: string }; Returns: boolean }
      sees_parent: { Args: { pid: string; sid: string }; Returns: boolean }
      sees_student: { Args: { sid: string; stid: string }; Returns: boolean }
      settle_tontine: {
        Args: { _month: string; _student_id: string }
        Returns: string
      }
      settle_tontine_month: {
        Args: { _month: string; _school_id: string }
        Returns: number
      }
      teaches_class: { Args: { cid: string; sid: string }; Returns: boolean }
      teaches_student: { Args: { sid: string; stid: string }; Returns: boolean }
      teaches_student_subject: {
        Args: { sid: string; stid: string; subj: string }
        Returns: boolean
      }
      teaches_subject: {
        Args: { cid: string; sid: string; subj: string }
        Returns: boolean
      }
      try_uuid: { Args: { t: string }; Returns: string }
    }
    Enums: {
      attendance_status: "present" | "absent" | "retard"
      fee_kind: "inscription" | "tranche" | "autre"
      gender: "M" | "F"
      school_role: "founder" | "director" | "secretary" | "teacher" | "primary"
      student_status: "actif" | "archive" | "transfere" | "sorti"
      teacher_status: "actif" | "conge" | "inactif"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attendance_status: ["present", "absent", "retard"],
      fee_kind: ["inscription", "tranche", "autre"],
      gender: ["M", "F"],
      school_role: ["founder", "director", "secretary", "teacher", "primary"],
      student_status: ["actif", "archive", "transfere", "sorti"],
      teacher_status: ["actif", "conge", "inactif"],
    },
  },
} as const
