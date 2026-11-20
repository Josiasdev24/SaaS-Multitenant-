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
    PostgrestVersion: "14.17"
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
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          label: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          label?: string
          start_date?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
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
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          student_id?: string
          subject_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_notes_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
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
          student_id?: string
          term_id?: string
          updated_at?: string
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_remarks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_remarks_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          coefficient: number
          id: string
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number
          id?: string
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number
          id?: string
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_main_teacher_id_fkey"
            columns: ["main_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      education_levels: {
        Row: {
          created_at: string
          cycle: string
          id: string
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          cycle: string
          id?: string
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          cycle?: string
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
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
          subject_id?: string
          term_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
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
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          label?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      fee_adjustment_effects: {
        Row: {
          adjustment_id: string
          created_row: boolean
          delta: number
          id: string
          student_fee_id: string
        }
        Insert: {
          adjustment_id: string
          created_row?: boolean
          delta: number
          id?: string
          student_fee_id: string
        }
        Update: {
          adjustment_id?: string
          created_row?: boolean
          delta?: number
          id?: string
          student_fee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustment_effects_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "fee_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustment_effects_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["id"]
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
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          student_fee_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_student_fee_id_fkey"
            columns: ["student_fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          comment: string | null
          created_at: string
          evaluation_id: string
          id: string
          score: number | null
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          score?: number | null
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          score?: number | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incomes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          updated_at?: string
        }
        Relationships: []
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
          student_id?: string | null
          student_name?: string | null
        }
        Relationships: []
      }
      primary_scores: {
        Row: {
          id: string
          month_key: string
          score: number | null
          student_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          month_key: string
          score?: number | null
          student_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          month_key?: string
          score?: number | null
          student_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primary_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primary_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "primary_subjects"
            referencedColumns: ["id"]
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
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_supervisor: boolean
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_supervisor?: boolean
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_supervisor?: boolean
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_teacher_fk"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_cards: {
        Row: {
          appreciation: string | null
          general_average: number | null
          generated_at: string | null
          id: string
          student_id: string
          term_id: string
        }
        Insert: {
          appreciation?: string | null
          general_average?: number | null
          generated_at?: string | null
          id?: string
          student_id: string
          term_id: string
        }
        Update: {
          appreciation?: string | null
          general_average?: number | null
          generated_at?: string | null
          id?: string
          student_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
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
        }
        Relationships: [
          {
            foreignKeyName: "school_fees_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_fees_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          absence_threshold: number
          address: string | null
          currency: string
          current_academic_year_id: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          short_name: string | null
          updated_at: string
        }
        Insert: {
          absence_threshold?: number
          address?: string | null
          currency?: string
          current_academic_year_id?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          absence_threshold?: number
          address?: string | null
          currency?: string
          current_academic_year_id?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_current_academic_year_id_fkey"
            columns: ["current_academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount_due: number
          due_date: string | null
          id: string
          school_fee_id: string
          student_id: string
        }
        Insert: {
          amount_due: number
          due_date?: string | null
          id?: string
          school_fee_id: string
          student_id: string
        }
        Update: {
          amount_due?: number
          due_date?: string | null
          id?: string
          school_fee_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_school_fee_id_fkey"
            columns: ["school_fee_id"]
            isOneToOne: false
            referencedRelation: "school_fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          id: string
          is_primary: boolean
          parent_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          parent_id: string
          relationship?: string
          student_id: string
        }
        Update: {
          id?: string
          is_primary?: boolean
          parent_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
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
          siblings?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
        }
        Insert: {
          code: string
          created_at?: string
          default_coefficient?: number
          groupe?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          default_coefficient?: number
          groupe?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      teacher_subjects: {
        Row: {
          id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          id?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
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
          status?: Database["public"]["Enums"]["teacher_status"]
          updated_at?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          academic_year_id: string
          end_date: string
          id: string
          name: string
          order_index: number
          start_date: string
        }
        Insert: {
          academic_year_id: string
          end_date: string
          id?: string
          name: string
          order_index?: number
          start_date: string
        }
        Update: {
          academic_year_id?: string
          end_date?: string
          id?: string
          name?: string
          order_index?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
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
          settled_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_deposits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_fee_adjustment: {
        Args: {
          _amount: number
          _kind: string
          _label?: string
          _student_id: string
        }
        Returns: string
      }
      assign_student_fees: {
        Args: { _include_inscription?: boolean; _student_id: string }
        Returns: number
      }
      can_edit_finance: { Args: never; Returns: boolean }
      can_see_class: { Args: { _class_id: string }; Returns: boolean }
      can_see_parent: { Args: { _parent_id: string }; Returns: boolean }
      can_see_student: { Args: { _student_id: string }; Returns: boolean }
      can_view_academics: { Args: never; Returns: boolean }
      can_view_finance: { Args: never; Returns: boolean }
      can_view_school_records: { Args: never; Returns: boolean }
      current_teacher_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_direction: { Args: never; Returns: boolean }
      is_college_director: { Args: never; Returns: boolean }
      is_main_teacher_of_student: {
        Args: { _student_id: string }
        Returns: boolean
      }
      is_primary_class: { Args: { _class_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_supervisor: { Args: never; Returns: boolean }
      remove_fee_adjustment: {
        Args: { _adjustment_id: string }
        Returns: undefined
      }
      settle_tontine: {
        Args: { _month: string; _student_id: string }
        Returns: string
      }
      settle_tontine_month: { Args: { _month: string }; Returns: number }
      student_in_college: { Args: { _student_id: string }; Returns: boolean }
      teaches_class: { Args: { _class_id: string }; Returns: boolean }
      teaches_class_subject: {
        Args: { _class_id: string; _subject_id: string }
        Returns: boolean
      }
      teaches_student: { Args: { _student_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "direction"
        | "comptabilite"
        | "enseignant"
        | "primaire"
      attendance_status: "present" | "absent" | "retard"
      fee_kind: "inscription" | "tranche" | "autre"
      gender: "M" | "F"
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
      app_role: [
        "admin",
        "direction",
        "comptabilite",
        "enseignant",
        "primaire",
      ],
      attendance_status: ["present", "absent", "retard"],
      fee_kind: ["inscription", "tranche", "autre"],
      gender: ["M", "F"],
      student_status: ["actif", "archive", "transfere", "sorti"],
      teacher_status: ["actif", "conge", "inactif"],
    },
  },
} as const
