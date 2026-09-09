export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_context_snapshots: {
        Row: {
          agent_name: string
          brand_id: string | null
          content: Json
          created_at: string
          embedding: string | null
          id: string
          session_id: string
          snapshot_type: string
          summary: string | null
          task_type: string
          token_estimate: number | null
          user_id: string
        }
        Insert: {
          agent_name: string
          brand_id?: string | null
          content?: Json
          created_at?: string
          embedding?: string | null
          id?: string
          session_id: string
          snapshot_type: string
          summary?: string | null
          task_type: string
          token_estimate?: number | null
          user_id: string
        }
        Update: {
          agent_name?: string
          brand_id?: string | null
          content?: Json
          created_at?: string
          embedding?: string | null
          id?: string
          session_id?: string
          snapshot_type?: string
          summary?: string | null
          task_type?: string
          token_estimate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_context_snapshots_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_decision_log: {
        Row: {
          agent_name: string | null
          approver_id: string | null
          brand_id: string | null
          created_at: string
          decision: string
          decision_type: string
          draft_id: string | null
          id: string
          payload: Json | null
          rationale: string | null
          session_id: string
          task_type: string | null
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          approver_id?: string | null
          brand_id?: string | null
          created_at?: string
          decision: string
          decision_type: string
          draft_id?: string | null
          id?: string
          payload?: Json | null
          rationale?: string | null
          session_id: string
          task_type?: string | null
          user_id: string
        }
        Update: {
          agent_name?: string | null
          approver_id?: string | null
          brand_id?: string | null
          created_at?: string
          decision?: string
          decision_type?: string
          draft_id?: string | null
          id?: string
          payload?: Json | null
          rationale?: string | null
          session_id?: string
          task_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_decision_log_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_logs: {
        Row: {
          agent_name: string
          brand_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          input: Json
          model: string | null
          output: Json
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          agent_name: string
          brand_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          brand_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input?: Json
          model?: string | null
          output?: Json
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          marketplace_ids: string[]
          refresh_token: string
          seller_id: string
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          marketplace_ids: string[]
          refresh_token: string
          seller_id: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          marketplace_ids?: string[]
          refresh_token?: string
          seller_id?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      amazon_media_links: {
        Row: {
          amazon_image_url: string | null
          amazon_product_id: string
          asset_id: string
          created_at: string
          exported_at: string
          id: string
        }
        Insert: {
          amazon_image_url?: string | null
          amazon_product_id: string
          asset_id: string
          created_at?: string
          exported_at?: string
          id?: string
        }
        Update: {
          amazon_image_url?: string | null
          amazon_product_id?: string
          asset_id?: string
          created_at?: string
          exported_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_media_links_amazon_product_id_fkey"
            columns: ["amazon_product_id"]
            isOneToOne: false
            referencedRelation: "amazon_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amazon_media_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_products: {
        Row: {
          asin: string | null
          created_at: string
          id: string
          images: Json | null
          seller_id: string
          sku: string
          status: string | null
          synced_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          asin?: string | null
          created_at?: string
          id?: string
          images?: Json | null
          seller_id: string
          sku: string
          status?: string | null
          synced_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          asin?: string | null
          created_at?: string
          id?: string
          images?: Json | null
          seller_id?: string
          sku?: string
          status?: string | null
          synced_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      asset_events: {
        Row: {
          actor_id: string | null
          asset_id: string
          cloudinary_asset_id: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          reason: string | null
          request_id: string | null
          version: number | null
        }
        Insert: {
          actor_id?: string | null
          asset_id: string
          cloudinary_asset_id?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          version?: number | null
        }
        Update: {
          actor_id?: string | null
          asset_id?: string
          cloudinary_asset_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_links: {
        Row: {
          asset_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          role: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          role?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_variants: {
        Row: {
          asset_id: string
          cloudinary_public_id: string | null
          created_at: string
          file_size: number | null
          format: string
          height: number
          id: string
          is_primary: boolean | null
          quality: number | null
          status: string
          updated_at: string
          url: string
          width: number
        }
        Insert: {
          asset_id: string
          cloudinary_public_id?: string | null
          created_at?: string
          file_size?: number | null
          format: string
          height: number
          id?: string
          is_primary?: boolean | null
          quality?: number | null
          status?: string
          updated_at?: string
          url: string
          width: number
        }
        Update: {
          asset_id?: string
          cloudinary_public_id?: string | null
          created_at?: string
          file_size?: number | null
          format?: string
          height?: number
          id?: string
          is_primary?: boolean | null
          quality?: number | null
          status?: string
          updated_at?: string
          url?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          amazon_exported: boolean | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          brand_id: string | null
          cloudinary_public_id: string | null
          created_at: string
          dna_pillars: Json
          dna_score: number | null
          dna_status: string | null
          facebook_published: boolean | null
          file_size: number | null
          height: number | null
          id: string
          image_spec_id: string | null
          instagram_published: boolean | null
          metadata: Json | null
          mime_type: string | null
          shoot_id: string | null
          shopify_exported: boolean | null
          size_compliance: Json | null
          status: string
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          url: string
          v2_shoot_id: string | null
          width: number | null
        }
        Insert: {
          amazon_exported?: boolean | null
          asset_type: Database["public"]["Enums"]["asset_type"]
          brand_id?: string | null
          cloudinary_public_id?: string | null
          created_at?: string
          dna_pillars?: Json
          dna_score?: number | null
          dna_status?: string | null
          facebook_published?: boolean | null
          file_size?: number | null
          height?: number | null
          id?: string
          image_spec_id?: string | null
          instagram_published?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          shoot_id?: string | null
          shopify_exported?: boolean | null
          size_compliance?: Json | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          url: string
          v2_shoot_id?: string | null
          width?: number | null
        }
        Update: {
          amazon_exported?: boolean | null
          asset_type?: Database["public"]["Enums"]["asset_type"]
          brand_id?: string | null
          cloudinary_public_id?: string | null
          created_at?: string
          dna_pillars?: Json
          dna_score?: number | null
          dna_status?: string | null
          facebook_published?: boolean | null
          file_size?: number | null
          height?: number | null
          id?: string
          image_spec_id?: string | null
          instagram_published?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          shoot_id?: string | null
          shopify_exported?: boolean | null
          size_compliance?: Json | null
          status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          url?: string
          v2_shoot_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_image_spec_id_fkey"
            columns: ["image_spec_id"]
            isOneToOne: false
            referencedRelation: "image_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_v2_shoot_id_fkey"
            columns: ["v2_shoot_id"]
            isOneToOne: false
            referencedRelation: "shoot_portfolio_view"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_agent_results: {
        Row: {
          agent_name: string
          agent_version: string | null
          brand_id: string
          completed_at: string | null
          confidence: number | null
          created_at: string
          duration_ms: number | null
          id: string
          model: string | null
          output: Json
          run_id: string | null
          started_at: string | null
          status: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent_name: string
          agent_version?: string | null
          brand_id: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string | null
          output?: Json
          run_id?: string | null
          started_at?: string | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent_name?: string
          agent_version?: string | null
          brand_id?: string
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string | null
          output?: Json
          run_id?: string | null
          started_at?: string | null
          status?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_agent_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_competitors: {
        Row: {
          brand_id: string
          category: string | null
          created_at: string
          id: string
          last_analyzed_at: string | null
          name: string
          price_point: string | null
          profile_jsonb: Json
          scores: Json
          social_presence: Json
          strengths: Json
          threat_level: string | null
          unique_angles: Json
          url: string | null
          weaknesses: Json
        }
        Insert: {
          brand_id: string
          category?: string | null
          created_at?: string
          id?: string
          last_analyzed_at?: string | null
          name: string
          price_point?: string | null
          profile_jsonb?: Json
          scores?: Json
          social_presence?: Json
          strengths?: Json
          threat_level?: string | null
          unique_angles?: Json
          url?: string | null
          weaknesses?: Json
        }
        Update: {
          brand_id?: string
          category?: string | null
          created_at?: string
          id?: string
          last_analyzed_at?: string | null
          name?: string
          price_point?: string | null
          profile_jsonb?: Json
          scores?: Json
          social_presence?: Json
          strengths?: Json
          threat_level?: string | null
          unique_angles?: Json
          url?: string | null
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "brand_competitors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_crawl_results: {
        Row: {
          brand_id: string
          completed_at: string | null
          crawl_id: string | null
          created_at: string
          description: string | null
          firecrawl_job_id: string | null
          firecrawl_scrape_id: string | null
          id: string
          markdown: string | null
          page_depth: number | null
          page_url: string | null
          pages_crawled: number
          raw_data: Json
          raw_json: Json
          started_at: string | null
          status: string
          status_code: number | null
          title: string | null
          word_count: number | null
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          crawl_id?: string | null
          created_at?: string
          description?: string | null
          firecrawl_job_id?: string | null
          firecrawl_scrape_id?: string | null
          id?: string
          markdown?: string | null
          page_depth?: number | null
          page_url?: string | null
          pages_crawled?: number
          raw_data?: Json
          raw_json?: Json
          started_at?: string | null
          status?: string
          status_code?: number | null
          title?: string | null
          word_count?: number | null
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          crawl_id?: string | null
          created_at?: string
          description?: string | null
          firecrawl_job_id?: string | null
          firecrawl_scrape_id?: string | null
          id?: string
          markdown?: string | null
          page_depth?: number | null
          page_url?: string | null
          pages_crawled?: number
          raw_data?: Json
          raw_json?: Json
          started_at?: string | null
          status?: string
          status_code?: number | null
          title?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_crawl_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_crawl_results_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "brand_crawls"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_crawls: {
        Row: {
          brand_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          firecrawl_job_id: string | null
          id: string
          idempotency_key: string | null
          job_status: Database["public"]["Enums"]["brand_crawl_job_status"]
          pages_crawled: number
          pages_failed: number
          pages_found: number
          pipeline_state:
            | Database["public"]["Enums"]["brand_crawl_pipeline_state"]
            | null
          raw_data: Json
          raw_payload: Json
          request_id: string | null
          retry_count: number
          source_url: string
          started_at: string | null
          started_by: string | null
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          firecrawl_job_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_status?: Database["public"]["Enums"]["brand_crawl_job_status"]
          pages_crawled?: number
          pages_failed?: number
          pages_found?: number
          pipeline_state?:
            | Database["public"]["Enums"]["brand_crawl_pipeline_state"]
            | null
          raw_data?: Json
          raw_payload?: Json
          request_id?: string | null
          retry_count?: number
          source_url: string
          started_at?: string | null
          started_by?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          firecrawl_job_id?: string | null
          id?: string
          idempotency_key?: string | null
          job_status?: Database["public"]["Enums"]["brand_crawl_job_status"]
          pages_crawled?: number
          pages_failed?: number
          pages_found?: number
          pipeline_state?:
            | Database["public"]["Enums"]["brand_crawl_pipeline_state"]
            | null
          raw_data?: Json
          raw_payload?: Json
          request_id?: string | null
          retry_count?: number
          source_url?: string
          started_at?: string | null
          started_by?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_crawls_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_graph_edges: {
        Row: {
          brand_id: string
          created_at: string
          edge_type: string
          id: string
          properties: Json
          source_node_id: string
          strength: number | null
          target_node_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          edge_type: string
          id?: string
          properties?: Json
          source_node_id: string
          strength?: number | null
          target_node_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          edge_type?: string
          id?: string
          properties?: Json
          source_node_id?: string
          strength?: number | null
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_graph_edges_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_graph_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "brand_graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_graph_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "brand_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_graph_nodes: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          embedding: string | null
          external_id: string | null
          id: string
          label: string
          node_type: string
          properties: Json
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          embedding?: string | null
          external_id?: string | null
          id?: string
          label: string
          node_type: string
          properties?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          embedding?: string | null
          external_id?: string | null
          id?: string
          label?: string
          node_type?: string
          properties?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_graph_nodes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_intake_drafts: {
        Row: {
          approved_at: string | null
          brand_id: string | null
          citations: Json
          created_at: string
          draft_profile: Json
          draft_scores: Json
          expires_at: string | null
          id: string
          rejected_at: string | null
          source_url: string
          status: string
          updated_at: string
          url_retrieval: Json
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          brand_id?: string | null
          citations?: Json
          created_at?: string
          draft_profile?: Json
          draft_scores?: Json
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          source_url: string
          status?: string
          updated_at?: string
          url_retrieval?: Json
          user_id: string
        }
        Update: {
          approved_at?: string | null
          brand_id?: string | null
          citations?: Json
          created_at?: string
          draft_profile?: Json
          draft_scores?: Json
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          source_url?: string
          status?: string
          updated_at?: string
          url_retrieval?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_intake_drafts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_scores: {
        Row: {
          brand_id: string
          created_at: string
          details: Json
          id: string
          score: number
          score_type: string
          score_version: number
          source: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          details?: Json
          id?: string
          score: number
          score_type: string
          score_version?: number
          source?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          details?: Json
          id?: string
          score?: number
          score_type?: string
          score_version?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_scores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_social_channels: {
        Row: {
          bio: string | null
          brand_id: string
          content_themes: Json
          created_at: string
          discovered_at: string
          follower_signal: string | null
          handle: string | null
          id: string
          platform: string
          posting_frequency: string | null
          url: string | null
          verified: boolean
        }
        Insert: {
          bio?: string | null
          brand_id: string
          content_themes?: Json
          created_at?: string
          discovered_at?: string
          follower_signal?: string | null
          handle?: string | null
          id?: string
          platform: string
          posting_frequency?: string | null
          url?: string | null
          verified?: boolean
        }
        Update: {
          bio?: string | null
          brand_id?: string
          content_themes?: Json
          created_at?: string
          discovered_at?: string
          follower_signal?: string | null
          handle?: string | null
          id?: string
          platform?: string
          posting_frequency?: string | null
          url?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brand_social_channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          ai_profile: Json
          ai_profile_draft: Json | null
          analysis_lock_token: string | null
          analysis_locked_at: string | null
          brand_url: string | null
          created_at: string
          creative_temperature_default: number
          embedding: string | null
          id: string
          instagram_handle: string | null
          intake_status: Database["public"]["Enums"]["brand_intake_status"]
          name: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_profile?: Json
          ai_profile_draft?: Json | null
          analysis_lock_token?: string | null
          analysis_locked_at?: string | null
          brand_url?: string | null
          created_at?: string
          creative_temperature_default?: number
          embedding?: string | null
          id?: string
          instagram_handle?: string | null
          intake_status?: Database["public"]["Enums"]["brand_intake_status"]
          name: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_profile?: Json
          ai_profile_draft?: Json | null
          analysis_lock_token?: string | null
          analysis_locked_at?: string | null
          brand_url?: string | null
          created_at?: string
          creative_temperature_default?: number
          embedding?: string | null
          id?: string
          instagram_handle?: string | null
          intake_status?: Database["public"]["Enums"]["brand_intake_status"]
          name?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_times: {
        Row: {
          call_time: string
          created_at: string | null
          date: string | null
          designer_id: string | null
          event_id: string
          id: string
          model_id: string | null
          model_profile_id: string | null
          notes: string | null
          schedule_item_id: string | null
          stakeholder_id: string | null
          time: string | null
        }
        Insert: {
          call_time: string
          created_at?: string | null
          date?: string | null
          designer_id?: string | null
          event_id: string
          id?: string
          model_id?: string | null
          model_profile_id?: string | null
          notes?: string | null
          schedule_item_id?: string | null
          stakeholder_id?: string | null
          time?: string | null
        }
        Update: {
          call_time?: string
          created_at?: string | null
          date?: string | null
          designer_id?: string | null
          event_id?: string
          id?: string
          model_id?: string | null
          model_profile_id?: string | null
          notes?: string | null
          schedule_item_id?: string | null
          stakeholder_id?: string | null
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_times_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "fashion_show_designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_times_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_times_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_times_model_profile_id_fkey"
            columns: ["model_profile_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_times_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "event_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_times_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliverables: {
        Row: {
          assigned_to: string | null
          campaign_id: string
          created_at: string
          due_date: string | null
          id: string
          label: string
          phase: number
          status: Database["public"]["Enums"]["deliverable_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          label: string
          phase: number
          status?: Database["public"]["Enums"]["deliverable_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          label?: string
          phase?: number
          status?: Database["public"]["Enums"]["deliverable_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliverables_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliverables_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          cover_url: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          objective:
            | Database["public"]["Enums"]["campaign_objective_type"]
            | null
          org_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
        }
        Insert: {
          brand_id: string
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          objective?:
            | Database["public"]["Enums"]["campaign_objective_type"]
            | null
          org_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Update: {
          brand_id?: string
          cover_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          objective?:
            | Database["public"]["Enums"]["campaign_objective_type"]
            | null
          org_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          anon_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chatbot_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          payload: Json
          type: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloudinary_assets: {
        Row: {
          approval: string
          asset_id: string
          bytes: number | null
          cloudinary_asset_id: string | null
          created_at: string
          created_by: string | null
          delivery_type: string
          duration: number | null
          folder: string | null
          format: string | null
          height: number | null
          id: string
          metadata: Json
          moderation_status: string
          public_id: string
          resource_type: string
          secure_url: string
          status: string
          updated_at: string
          version: number | null
          width: number | null
        }
        Insert: {
          approval?: string
          asset_id: string
          bytes?: number | null
          cloudinary_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_type?: string
          duration?: number | null
          folder?: string | null
          format?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          moderation_status?: string
          public_id: string
          resource_type: string
          secure_url: string
          status?: string
          updated_at?: string
          version?: number | null
          width?: number | null
        }
        Update: {
          approval?: string
          asset_id?: string
          bytes?: number | null
          cloudinary_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_type?: string
          duration?: number | null
          folder?: string | null
          format?: string | null
          height?: number | null
          id?: string
          metadata?: Json
          moderation_status?: string
          public_id?: string
          resource_type?: string
          secure_url?: string
          status?: string
          updated_at?: string
          version?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cloudinary_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_product_links: {
        Row: {
          asset_id: string | null
          brand_id: string
          created_at: string
          id: string
          medusa_product_id: string
          shoot_id: string | null
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          brand_id: string
          created_at?: string
          id?: string
          medusa_product_id: string
          shoot_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          medusa_product_id?: string
          shoot_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_product_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_links_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_product_links_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          body: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          org_id: string
          type: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          org_id: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          org_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_org_company_fkey"
            columns: ["org_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "crm_activities_org_contact_fkey"
            columns: ["org_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "crm_activities_org_deal_fkey"
            columns: ["org_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "crm_activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          brand_id: string | null
          created_at: string
          domain: string | null
          id: string
          industry: string | null
          name: string
          org_id: string
          owner: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          name: string
          org_id: string
          owner?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          name?: string
          org_id?: string
          owner?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_companies_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: Json
          id: string
          name: string
          org_id: string
          phone: Json
          profile_id: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: Json
          id?: string
          name: string
          org_id: string
          phone?: Json
          profile_id?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: Json
          id?: string
          name?: string
          org_id?: string
          phone?: Json
          profile_id?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_org_company_fkey"
            columns: ["org_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "crm_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          campaign_id: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          currency: string
          expected_close_date: string | null
          id: string
          org_id: string
          owner: string | null
          shoot_id: string | null
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          campaign_id?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          org_id: string
          owner?: string | null
          shoot_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          campaign_id?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          org_id?: string
          owner?: string | null
          shoot_id?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_org_company_fkey"
            columns: ["org_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "crm_deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_crm_deals_campaign"
            columns: ["org_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      designer_availability: {
        Row: {
          brand_id: string
          created_at: string | null
          date: string | null
          end_time: string
          end_time_only: string | null
          event_id: string | null
          id: string
          notes: string | null
          start_time: string
          start_time_only: string | null
          status: Database["public"]["Enums"]["availability_status"] | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          date?: string | null
          end_time: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          start_time: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          date?: string | null
          end_time?: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "designer_availability_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "fashion_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designer_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_assets: {
        Row: {
          alt_text: string | null
          created_at: string | null
          event_id: string
          generation_prompt: string | null
          generation_status: string | null
          id: string
          is_featured: boolean | null
          type: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          event_id: string
          generation_prompt?: string | null
          generation_status?: string | null
          id?: string
          is_featured?: boolean | null
          type: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          event_id?: string
          generation_prompt?: string | null
          generation_status?: string | null
          id?: string
          is_featured?: boolean | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_designers: {
        Row: {
          brand_id: string | null
          collection_name: string | null
          created_at: string | null
          designer_id: string | null
          designer_name: string | null
          event_id: string
          id: string
          is_primary_designer: boolean | null
        }
        Insert: {
          brand_id?: string | null
          collection_name?: string | null
          created_at?: string | null
          designer_id?: string | null
          designer_name?: string | null
          event_id: string
          id?: string
          is_primary_designer?: boolean | null
        }
        Update: {
          brand_id?: string | null
          collection_name?: string | null
          created_at?: string | null
          designer_id?: string | null
          designer_name?: string | null
          event_id?: string
          id?: string
          is_primary_designer?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_designers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "fashion_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_designers_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "fashion_show_designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_designers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_models: {
        Row: {
          created_at: string | null
          event_id: string
          fitting_date: string | null
          fitting_status: Database["public"]["Enums"]["fitting_status"] | null
          id: string
          is_closing: boolean | null
          is_opening: boolean | null
          look_count: number | null
          model_profile_id: string
          notes: string | null
          rate: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          fitting_date?: string | null
          fitting_status?: Database["public"]["Enums"]["fitting_status"] | null
          id?: string
          is_closing?: boolean | null
          is_opening?: boolean | null
          look_count?: number | null
          model_profile_id: string
          notes?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          fitting_date?: string | null
          fitting_status?: Database["public"]["Enums"]["fitting_status"] | null
          id?: string
          is_closing?: boolean | null
          is_opening?: boolean | null
          look_count?: number | null
          model_profile_id?: string
          notes?: string | null
          rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_models_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_models_model_profile_id_fkey"
            columns: ["model_profile_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_phases: {
        Row: {
          actual_completion_date: string | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          order_index: number
          phase_key: string
          phase_name: string
          start_date: string | null
          status: Database["public"]["Enums"]["phase_status"] | null
          target_completion_date: string | null
          updated_at: string | null
        }
        Insert: {
          actual_completion_date?: string | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          order_index: number
          phase_key: string
          phase_name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"] | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_completion_date?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          order_index?: number
          phase_key?: string
          phase_name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["phase_status"] | null
          target_completion_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_phases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rehearsals: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          event_id: string
          id: string
          notes: string | null
          rehearsal_lead_id: string | null
          rehearsal_type: Database["public"]["Enums"]["rehearsal_type"] | null
          required_crew: number | null
          required_designers: number | null
          required_models: number | null
          start_time: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          event_id: string
          id?: string
          notes?: string | null
          rehearsal_lead_id?: string | null
          rehearsal_type?: Database["public"]["Enums"]["rehearsal_type"] | null
          required_crew?: number | null
          required_designers?: number | null
          required_models?: number | null
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          rehearsal_lead_id?: string | null
          rehearsal_type?: Database["public"]["Enums"]["rehearsal_type"] | null
          required_crew?: number | null
          required_designers?: number | null
          required_models?: number | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rehearsals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rehearsals_rehearsal_lead_id_fkey"
            columns: ["rehearsal_lead_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedule: {
        Row: {
          assigned_models: string[] | null
          assigned_stakeholders: string[] | null
          created_at: string | null
          date: string | null
          description: string | null
          designer_id: string | null
          end_time: string | null
          end_time_only: string | null
          event_id: string
          id: string
          location: string | null
          model_id: string | null
          schedule_type: Database["public"]["Enums"]["schedule_type"] | null
          stakeholder_id: string | null
          start_time: string
          start_time_only: string | null
          title: string
        }
        Insert: {
          assigned_models?: string[] | null
          assigned_stakeholders?: string[] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          designer_id?: string | null
          end_time?: string | null
          end_time_only?: string | null
          event_id: string
          id?: string
          location?: string | null
          model_id?: string | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"] | null
          stakeholder_id?: string | null
          start_time: string
          start_time_only?: string | null
          title: string
        }
        Update: {
          assigned_models?: string[] | null
          assigned_stakeholders?: string[] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          designer_id?: string | null
          end_time?: string | null
          end_time_only?: string | null
          event_id?: string
          id?: string
          location?: string | null
          model_id?: string | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"] | null
          stakeholder_id?: string | null
          start_time?: string
          start_time_only?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_schedule_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "fashion_show_designer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_schedule_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_schedule_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_schedule_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedules: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          event_id: string
          id: string
          location_in_venue: string | null
          speaker_names: string[] | null
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          location_in_venue?: string | null
          speaker_names?: string[] | null
          start_time: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          location_in_venue?: string | null
          speaker_names?: string[] | null
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sponsors: {
        Row: {
          amount: number | null
          contract_url: string | null
          created_at: string | null
          deliverables: Json | null
          event_id: string
          id: string
          package_id: string | null
          sponsor_org_id: string
          status: string | null
          tier: Database["public"]["Enums"]["sponsor_tier"]
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          contract_url?: string | null
          created_at?: string | null
          deliverables?: Json | null
          event_id: string
          id?: string
          package_id?: string | null
          sponsor_org_id: string
          status?: string | null
          tier: Database["public"]["Enums"]["sponsor_tier"]
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          contract_url?: string | null
          created_at?: string | null
          deliverables?: Json | null
          event_id?: string
          id?: string
          package_id?: string | null
          sponsor_org_id?: string
          status?: string | null
          tier?: Database["public"]["Enums"]["sponsor_tier"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsors_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsors_sponsor_org_id_fkey"
            columns: ["sponsor_org_id"]
            isOneToOne: false
            referencedRelation: "sponsor_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stakeholders: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          rate: number | null
          role: Database["public"]["Enums"]["stakeholder_role"]
          stakeholder_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          rate?: number | null
          role: Database["public"]["Enums"]["stakeholder_role"]
          stakeholder_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          rate?: number | null
          role?: Database["public"]["Enums"]["stakeholder_role"]
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_stakeholders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_stakeholders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ai_summary: string | null
          brand_color_primary: string | null
          brand_color_secondary: string | null
          capacity_limit: number | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          event_type: string | null
          id: string
          is_public: boolean | null
          organizer_id: string
          organizer_team_id: string | null
          short_description: string | null
          slug: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"] | null
          timezone: string | null
          title: string
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          capacity_limit?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_public?: boolean | null
          organizer_id: string
          organizer_team_id?: string | null
          short_description?: string | null
          slug: string
          start_time: string
          status?: Database["public"]["Enums"]["event_status"] | null
          timezone?: string | null
          title: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          capacity_limit?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_public?: boolean | null
          organizer_id?: string
          organizer_team_id?: string | null
          short_description?: string | null
          slug?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"] | null
          timezone?: string | null
          title?: string
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_team_id_fkey"
            columns: ["organizer_team_id"]
            isOneToOne: false
            referencedRelation: "organizer_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_connections: {
        Row: {
          access_token: string
          created_at: string
          facebook_page_id: string
          facebook_page_name: string | null
          id: string
          last_sync_at: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          facebook_page_id: string
          facebook_page_name?: string | null
          id?: string
          last_sync_at?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          facebook_page_id?: string
          facebook_page_name?: string | null
          id?: string
          last_sync_at?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      facebook_posts: {
        Row: {
          asset_ids: string[] | null
          comment_count: number | null
          connection_id: string
          created_at: string
          facebook_post_id: string
          id: string
          like_count: number | null
          link: string | null
          message: string | null
          permalink: string | null
          post_type: string | null
          published_at: string | null
          share_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_ids?: string[] | null
          comment_count?: number | null
          connection_id: string
          created_at?: string
          facebook_post_id: string
          id?: string
          like_count?: number | null
          link?: string | null
          message?: string | null
          permalink?: string | null
          post_type?: string | null
          published_at?: string | null
          share_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_ids?: string[] | null
          comment_count?: number | null
          connection_id?: string
          created_at?: string
          facebook_post_id?: string
          id?: string
          like_count?: number | null
          link?: string | null
          message?: string | null
          permalink?: string | null
          post_type?: string | null
          published_at?: string | null
          share_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "facebook_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      fashion_brands: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      fashion_show_designer_profiles: {
        Row: {
          bio: string | null
          brand_id: string | null
          created_at: string
          full_name: string
          id: string
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          brand_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          brand_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fashion_show_designer_profiles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "fashion_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      image_specs: {
        Row: {
          accepted_formats: string[]
          aspect_ratio_h: number | null
          aspect_ratio_label: string | null
          aspect_ratio_w: number | null
          background_required: string | null
          best_use_cases: string[] | null
          created_at: string
          crop_notes: string | null
          desktop_notes: string | null
          height_px: number
          id: string
          image_type_id: string | null
          last_verified_at: string | null
          max_file_size_mb: number | null
          max_height_px: number | null
          max_width_px: number | null
          min_height_px: number | null
          min_width_px: number | null
          mobile_notes: string | null
          organic: boolean
          paid: boolean
          platform_id: string | null
          product_fill_min_pct: number | null
          recommended_color_mode: string | null
          safe_zone_bottom_px: number | null
          safe_zone_left_px: number | null
          safe_zone_right_px: number | null
          safe_zone_top_px: number | null
          shopping_support: boolean
          source_url: string | null
          spec_confidence: Database["public"]["Enums"]["spec_confidence"]
          width_px: number
        }
        Insert: {
          accepted_formats: string[]
          aspect_ratio_h?: number | null
          aspect_ratio_label?: string | null
          aspect_ratio_w?: number | null
          background_required?: string | null
          best_use_cases?: string[] | null
          created_at?: string
          crop_notes?: string | null
          desktop_notes?: string | null
          height_px: number
          id?: string
          image_type_id?: string | null
          last_verified_at?: string | null
          max_file_size_mb?: number | null
          max_height_px?: number | null
          max_width_px?: number | null
          min_height_px?: number | null
          min_width_px?: number | null
          mobile_notes?: string | null
          organic?: boolean
          paid?: boolean
          platform_id?: string | null
          product_fill_min_pct?: number | null
          recommended_color_mode?: string | null
          safe_zone_bottom_px?: number | null
          safe_zone_left_px?: number | null
          safe_zone_right_px?: number | null
          safe_zone_top_px?: number | null
          shopping_support?: boolean
          source_url?: string | null
          spec_confidence?: Database["public"]["Enums"]["spec_confidence"]
          width_px: number
        }
        Update: {
          accepted_formats?: string[]
          aspect_ratio_h?: number | null
          aspect_ratio_label?: string | null
          aspect_ratio_w?: number | null
          background_required?: string | null
          best_use_cases?: string[] | null
          created_at?: string
          crop_notes?: string | null
          desktop_notes?: string | null
          height_px?: number
          id?: string
          image_type_id?: string | null
          last_verified_at?: string | null
          max_file_size_mb?: number | null
          max_height_px?: number | null
          max_width_px?: number | null
          min_height_px?: number | null
          min_width_px?: number | null
          mobile_notes?: string | null
          organic?: boolean
          paid?: boolean
          platform_id?: string | null
          product_fill_min_pct?: number | null
          recommended_color_mode?: string | null
          safe_zone_bottom_px?: number | null
          safe_zone_left_px?: number | null
          safe_zone_right_px?: number | null
          safe_zone_top_px?: number | null
          shopping_support?: boolean
          source_url?: string | null
          spec_confidence?: Database["public"]["Enums"]["spec_confidence"]
          width_px?: number
        }
        Relationships: [
          {
            foreignKeyName: "image_specs_image_type_id_fkey"
            columns: ["image_type_id"]
            isOneToOne: false
            referencedRelation: "image_type_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_specs_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      image_type_defs: {
        Row: {
          best_campaign_objectives:
            | Database["public"]["Enums"]["campaign_objective_type"][]
            | null
          best_funnel_stages:
            | Database["public"]["Enums"]["funnel_stage_type"][]
            | null
          best_industries: string[] | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_organic: boolean
          is_paid: boolean
          is_shopping: boolean
          name: string
          slug: string
        }
        Insert: {
          best_campaign_objectives?:
            | Database["public"]["Enums"]["campaign_objective_type"][]
            | null
          best_funnel_stages?:
            | Database["public"]["Enums"]["funnel_stage_type"][]
            | null
          best_industries?: string[] | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_organic?: boolean
          is_paid?: boolean
          is_shopping?: boolean
          name: string
          slug: string
        }
        Update: {
          best_campaign_objectives?:
            | Database["public"]["Enums"]["campaign_objective_type"][]
            | null
          best_funnel_stages?:
            | Database["public"]["Enums"]["funnel_stage_type"][]
            | null
          best_industries?: string[] | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_organic?: boolean
          is_paid?: boolean
          is_shopping?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      instagram_connections: {
        Row: {
          access_token: string
          created_at: string
          facebook_page_access_token: string | null
          facebook_page_id: string | null
          id: string
          instagram_account_id: string
          instagram_username: string | null
          last_sync_at: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          id?: string
          instagram_account_id: string
          instagram_username?: string | null
          last_sync_at?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          facebook_page_access_token?: string | null
          facebook_page_id?: string | null
          id?: string
          instagram_account_id?: string
          instagram_username?: string | null
          last_sync_at?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          asset_ids: string[] | null
          caption: string | null
          comment_count: number | null
          connection_id: string
          created_at: string
          hashtags: string[] | null
          id: string
          instagram_media_id: string
          like_count: number | null
          location_name: string | null
          media_type: string
          permalink: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_ids?: string[] | null
          caption?: string | null
          comment_count?: number | null
          connection_id: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          instagram_media_id: string
          like_count?: number | null
          location_name?: string | null
          media_type: string
          permalink?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_ids?: string[] | null
          caption?: string | null
          comment_count?: number | null
          connection_id?: string
          created_at?: string
          hashtags?: string[] | null
          id?: string
          instagram_media_id?: string
          like_count?: number | null
          location_name?: string | null
          media_type?: string
          permalink?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_intake_drafts: {
        Row: {
          answers: Json
          claim_token: string | null
          claim_token_expires_at: string | null
          claimed_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          claim_token?: string | null
          claim_token_expires_at?: string | null
          claimed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          claim_token?: string | null
          claim_token_expires_at?: string | null
          claimed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_intake_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_size_specs: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          notes: string | null
          platform: string
          recommended_height: number
          recommended_width: number
          updated_at: string
          use_case: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform: string
          recommended_height: number
          recommended_width: number
          updated_at?: string
          use_case: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform?: string
          recommended_height?: number
          recommended_width?: number
          updated_at?: string
          use_case?: string
        }
        Relationships: []
      }
      model_agencies: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      model_availability: {
        Row: {
          created_at: string | null
          date: string | null
          end_time: string
          end_time_only: string | null
          event_id: string | null
          id: string
          model_profile_id: string
          notes: string | null
          start_time: string
          start_time_only: string | null
          status: Database["public"]["Enums"]["availability_status"] | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          end_time: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          model_profile_id: string
          notes?: string | null
          start_time: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          end_time?: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          model_profile_id?: string
          notes?: string | null
          start_time?: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "model_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_availability_model_profile_id_fkey"
            columns: ["model_profile_id"]
            isOneToOne: false
            referencedRelation: "model_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_profiles: {
        Row: {
          agency_id: string | null
          bust_cm: number | null
          created_at: string | null
          email: string | null
          eye_color: string | null
          hair_color: string | null
          height_cm: number | null
          hips_cm: number | null
          id: string
          instagram_handle: string | null
          name: string
          phone: string | null
          portfolio_url: string | null
          profile_id: string | null
          shoe_size: string | null
          updated_at: string | null
          waist_cm: number | null
        }
        Insert: {
          agency_id?: string | null
          bust_cm?: number | null
          created_at?: string | null
          email?: string | null
          eye_color?: string | null
          hair_color?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          instagram_handle?: string | null
          name: string
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          shoe_size?: string | null
          updated_at?: string | null
          waist_cm?: number | null
        }
        Update: {
          agency_id?: string | null
          bust_cm?: number | null
          created_at?: string | null
          email?: string | null
          eye_color?: string | null
          hair_color?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          instagram_handle?: string | null
          name?: string
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          shoe_size?: string | null
          updated_at?: string | null
          waist_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "model_agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_org_id: string | null
          brand_org_id: string | null
          channel: string
          created_at: string
          crm_deal_id: string | null
          id: string
          kind: string
          payload: Json
          read: boolean
          talent_profile_id: string | null
        }
        Insert: {
          agency_org_id?: string | null
          brand_org_id?: string | null
          channel?: string
          created_at?: string
          crm_deal_id?: string | null
          id?: string
          kind: string
          payload?: Json
          read?: boolean
          talent_profile_id?: string | null
        }
        Update: {
          agency_org_id?: string | null
          brand_org_id?: string | null
          channel?: string
          created_at?: string
          crm_deal_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          read?: boolean
          talent_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_org_id_fkey"
            columns: ["agency_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_brand_org_id_fkey"
            columns: ["brand_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_crm_deal_id_fkey"
            columns: ["crm_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          brand_id: string | null
          created_at: string
          current_screen: number
          draft_answers: Json
          id: string
          idempotency_key: string
          organization_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          current_screen?: number
          draft_answers?: Json
          id?: string
          idempotency_key: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          current_screen?: number
          draft_answers?: Json
          id?: string
          idempotency_key?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          joined_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          plan: string
          slug: string
          type: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          plan?: string
          slug: string
          type: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          plan?: string
          slug?: string
          type?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      organizer_team_members: {
        Row: {
          created_at: string
          id: string
          role_in_team: string | null
          stakeholder_id: string | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role_in_team?: string | null
          stakeholder_id?: string | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role_in_team?: string | null
          stakeholder_id?: string | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_team_members_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizer_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "organizer_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_teams: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          type: Database["public"]["Enums"]["organizer_type"] | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          type?: Database["public"]["Enums"]["organizer_type"] | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          type?: Database["public"]["Enums"]["organizer_type"] | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          payer_id: string | null
          provider: string | null
          provider_payment_id: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payer_id?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payer_id?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          category: string
          created_at: string
          has_carousel: boolean
          has_paid_ads: boolean
          has_shopping: boolean
          has_stories: boolean
          id: string
          name: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          has_carousel?: boolean
          has_paid_ads?: boolean
          has_shopping?: boolean
          has_stories?: boolean
          id?: string
          name: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          has_carousel?: boolean
          has_paid_ads?: boolean
          has_shopping?: boolean
          has_stories?: boolean
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      processed_firecrawl_webhooks: {
        Row: {
          crawl_id: string | null
          created_at: string
          event_type: string
          firecrawl_job_id: string
          status: string
          updated_at: string
          webhook_id: string
        }
        Insert: {
          crawl_id?: string | null
          created_at?: string
          event_type: string
          firecrawl_job_id: string
          status?: string
          updated_at?: string
          webhook_id: string
        }
        Update: {
          crawl_id?: string | null
          created_at?: string
          event_type?: string
          firecrawl_job_id?: string
          status?: string
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_firecrawl_webhooks_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "brand_crawls"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_status: string
          phone: string | null
          provider_user_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          onboarding_status?: string
          phone?: string | null
          provider_user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_status?: string
          phone?: string | null
          provider_user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_rules: {
        Row: {
          condition_key: string
          condition_value: string
          created_at: string
          id: string
          image_type_slugs: string[]
          notes: string | null
          platform_slugs: string[] | null
          priority: number
          rule_type: string
        }
        Insert: {
          condition_key: string
          condition_value: string
          created_at?: string
          id?: string
          image_type_slugs: string[]
          notes?: string | null
          platform_slugs?: string[] | null
          priority?: number
          rule_type: string
        }
        Update: {
          condition_key?: string
          condition_value?: string
          created_at?: string
          id?: string
          image_type_slugs?: string[]
          notes?: string | null
          platform_slugs?: string[] | null
          priority?: number
          rule_type?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attendee_email: string
          attendee_name: string
          checked_in_at: string | null
          created_at: string | null
          event_id: string
          id: string
          profile_id: string | null
          qr_code_data: string | null
          status: Database["public"]["Enums"]["registration_status"] | null
          ticket_tier_id: string
          updated_at: string | null
        }
        Insert: {
          attendee_email: string
          attendee_name: string
          checked_in_at?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          profile_id?: string | null
          qr_code_data?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          ticket_tier_id: string
          updated_at?: string | null
        }
        Update: {
          attendee_email?: string
          attendee_name?: string
          checked_in_at?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          profile_id?: string | null
          qr_code_data?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          ticket_tier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_tier_id_fkey"
            columns: ["ticket_tier_id"]
            isOneToOne: false
            referencedRelation: "ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_assets: {
        Row: {
          file_type: string | null
          filename: string | null
          id: string
          is_final: boolean | null
          metadata: Json | null
          shoot_id: string
          uploaded_at: string
          url: string
        }
        Insert: {
          file_type?: string | null
          filename?: string | null
          id?: string
          is_final?: boolean | null
          metadata?: Json | null
          shoot_id: string
          uploaded_at?: string
          url: string
        }
        Update: {
          file_type?: string | null
          filename?: string | null
          id?: string
          is_final?: boolean | null
          metadata?: Json | null
          shoot_id?: string
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoot_assets_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_items: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          name: string
          reference_image_url: string | null
          shoot_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          reference_image_url?: string | null
          shoot_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          reference_image_url?: string | null
          shoot_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shoot_items_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoot_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          provider_payment_id: string | null
          shoot_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          provider_payment_id?: string | null
          shoot_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          provider_payment_id?: string | null
          shoot_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shoot_payments_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
        ]
      }
      shoots: {
        Row: {
          brief_data: Json | null
          created_at: string
          currency: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          designer_id: string | null
          estimated_quote: number
          fashion_category: string
          fulfillment_type: string | null
          id: string
          looks_count: number
          product_size: string | null
          retouching_level:
            | Database["public"]["Enums"]["retouching_level"]
            | null
          scheduled_date: string | null
          scheduled_time: string | null
          shoot_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["shoot_status_v2"] | null
          style_type: string
          updated_at: string
        }
        Insert: {
          brief_data?: Json | null
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          designer_id?: string | null
          estimated_quote: number
          fashion_category: string
          fulfillment_type?: string | null
          id?: string
          looks_count?: number
          product_size?: string | null
          retouching_level?:
            | Database["public"]["Enums"]["retouching_level"]
            | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          shoot_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["shoot_status_v2"] | null
          style_type: string
          updated_at?: string
        }
        Update: {
          brief_data?: Json | null
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          designer_id?: string | null
          estimated_quote?: number
          fashion_category?: string
          fulfillment_type?: string | null
          id?: string
          looks_count?: number
          product_size?: string | null
          retouching_level?:
            | Database["public"]["Enums"]["retouching_level"]
            | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          shoot_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["shoot_status_v2"] | null
          style_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoots_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_media_links: {
        Row: {
          asset_id: string
          created_at: string
          exported_at: string
          id: string
          shopify_media_id: string | null
          shopify_product_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          exported_at?: string
          id?: string
          shopify_media_id?: string | null
          shopify_product_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          exported_at?: string
          id?: string
          shopify_media_id?: string | null
          shopify_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_media_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_media_links_shopify_product_id_fkey"
            columns: ["shopify_product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_products: {
        Row: {
          created_at: string
          description: string | null
          handle: string | null
          id: string
          images: Json | null
          product_type: string | null
          shop_id: string
          shopify_product_id: string
          shopify_variant_id: string | null
          status: string | null
          synced_at: string | null
          tags: string[] | null
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          handle?: string | null
          id?: string
          images?: Json | null
          product_type?: string | null
          shop_id: string
          shopify_product_id: string
          shopify_variant_id?: string | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          handle?: string | null
          id?: string
          images?: Json | null
          product_type?: string | null
          shop_id?: string
          shopify_product_id?: string
          shopify_variant_id?: string | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shopify_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_shops: {
        Row: {
          access_token: string
          created_at: string
          id: string
          installed_at: string
          last_sync_at: string | null
          scope: string
          shop_domain: string
          shop_name: string | null
          status: string
          uninstalled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          installed_at?: string
          last_sync_at?: string | null
          scope: string
          shop_domain: string
          shop_name?: string | null
          status?: string
          uninstalled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          installed_at?: string
          last_sync_at?: string | null
          scope?: string
          shop_domain?: string
          shop_name?: string | null
          status?: string
          uninstalled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsor_organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      sponsorship_packages: {
        Row: {
          created_at: string | null
          deliverables: Json | null
          id: string
          name: string
          price: number | null
          tier: Database["public"]["Enums"]["sponsor_tier"]
        }
        Insert: {
          created_at?: string | null
          deliverables?: Json | null
          id?: string
          name: string
          price?: number | null
          tier: Database["public"]["Enums"]["sponsor_tier"]
        }
        Update: {
          created_at?: string | null
          deliverables?: Json | null
          id?: string
          name?: string
          price?: number | null
          tier?: Database["public"]["Enums"]["sponsor_tier"]
        }
        Relationships: []
      }
      stakeholders: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          fashion_show_role:
            | Database["public"]["Enums"]["stakeholder_role_enum"]
            | null
          id: string
          instagram_handle: string | null
          linked_user_id: string | null
          name: string
          notes: string | null
          phone: string | null
          portfolio_url: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["stakeholder_role"]
          specializations: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fashion_show_role?:
            | Database["public"]["Enums"]["stakeholder_role_enum"]
            | null
          id?: string
          instagram_handle?: string | null
          linked_user_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          role: Database["public"]["Enums"]["stakeholder_role"]
          specializations?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fashion_show_role?:
            | Database["public"]["Enums"]["stakeholder_role_enum"]
            | null
          id?: string
          instagram_handle?: string | null
          linked_user_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          portfolio_url?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["stakeholder_role"]
          specializations?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          assignee_id: string
          created_at: string | null
          id: string
          stakeholder_id: string | null
          task_id: string
        }
        Insert: {
          assignee_id: string
          created_at?: string | null
          id?: string
          stakeholder_id?: string | null
          task_id: string
        }
        Update: {
          assignee_id?: string
          created_at?: string | null
          id?: string
          stakeholder_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          event_id: string | null
          id: string
          phase_id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          phase_id: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          phase_id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "event_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          event_id: string
          id: string
          name: string
          price: number | null
          quantity_sold: number | null
          quantity_total: number
          sales_end_at: string | null
          sales_start_at: string | null
          type: Database["public"]["Enums"]["ticket_tier_type"] | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_id: string
          id?: string
          name: string
          price?: number | null
          quantity_sold?: number | null
          quantity_total: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          type?: Database["public"]["Enums"]["ticket_tier_type"] | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          price?: number | null
          quantity_sold?: number | null
          quantity_total?: number
          sales_end_at?: string | null
          sales_start_at?: string | null
          type?: Database["public"]["Enums"]["ticket_tier_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_availability: {
        Row: {
          created_at: string | null
          date: string | null
          end_time: string
          end_time_only: string | null
          event_id: string | null
          id: string
          notes: string | null
          start_time: string
          start_time_only: string | null
          status: Database["public"]["Enums"]["availability_status"] | null
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          end_time: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          start_time: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
          venue_id: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          end_time?: string
          end_time_only?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          start_time_only?: string | null
          status?: Database["public"]["Enums"]["availability_status"] | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_availability_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          amenities: string[] | null
          capacity: number | null
          city: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          indoor_outdoor: Database["public"]["Enums"]["indoor_outdoor"] | null
          name: string
          notes: string | null
          owner_id: string | null
          type: Database["public"]["Enums"]["venue_type"] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          capacity?: number | null
          city: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          indoor_outdoor?: Database["public"]["Enums"]["indoor_outdoor"] | null
          name: string
          notes?: string | null
          owner_id?: string | null
          type?: Database["public"]["Enums"]["venue_type"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          capacity?: number | null
          city?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          indoor_outdoor?: Database["public"]["Enums"]["indoor_outdoor"] | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          type?: Database["public"]["Enums"]["venue_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      shoot_portfolio_view: {
        Row: {
          asset_count: number | null
          brand_id: string | null
          cover_url: string | null
          created_by: string | null
          dna_score: number | null
          end_date: string | null
          estimated_budget: number | null
          id: string | null
          location: string | null
          name: string | null
          shot_count: number | null
          start_date: string | null
          status: string | null
          target_channels: string[] | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shoots_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      shot_type_references_view: {
        Row: {
          angle: string | null
          background: string | null
          category: string | null
          channel_fit: string[] | null
          description: string | null
          id: string | null
          model_type: string | null
          subcategory: string | null
          tags: string[] | null
        }
        Insert: {
          angle?: string | null
          background?: string | null
          category?: string | null
          channel_fit?: string[] | null
          description?: string | null
          id?: string | null
          model_type?: string | null
          subcategory?: string | null
          tags?: string[] | null
        }
        Update: {
          angle?: string | null
          background?: string | null
          category?: string | null
          channel_fit?: string[] | null
          description?: string | null
          id?: string | null
          model_type?: string | null
          subcategory?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_cloudinary_asset_event: { Args: { p_event: Json }; Returns: Json }
      apply_cloudinary_asset_events: { Args: { p_events: Json }; Returns: Json }
      calculate_shoot_price: {
        Args: {
          p_fulfillment_type?: string
          p_looks_count: number
          p_retouching_level?: Database["public"]["Enums"]["retouching_level"]
          p_shoot_type: Database["public"]["Enums"]["service_type"]
        }
        Returns: number
      }
      capture_lead_write: {
        Args: {
          p_anon_id: string
          p_answers?: Json
          p_claim_expires_at?: string
          p_claim_token?: string
          p_conversation_id?: string
          p_message_summary?: string
          p_service_interest?: string
        }
        Returns: Json
      }
      check_talent_availability: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_talent_profile_id: string
        }
        Returns: Json
      }
      claim_lead_draft: {
        Args: { p_claim_token: string; p_draft_id: string }
        Returns: {
          answers: Json
          claim_token: string | null
          claim_token_expires_at: string | null
          claimed_at: string | null
          conversation_id: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lead_intake_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_shoot_draft: {
        Args: {
          p_brand_id: string
          p_brief?: string
          p_budget_breakdown?: Json
          p_created_by?: string
          p_deliverables?: Json
          p_estimated_budget?: number
          p_name: string
          p_shots?: Json
          p_target_channels?: string[]
        }
        Returns: Json
      }
      confirm_booking: { Args: { p_booking_id: string }; Returns: Json }
      create_booking_request: {
        Args: {
          p_brand_org_id: string
          p_date_end: string
          p_date_start: string
          p_message?: string
          p_rate_quoted?: number
          p_shoot_id?: string
          p_talent_profile_id: string
        }
        Returns: Json
      }
      create_talent_profile_with_sources: {
        Args: {
          p_agency_org_id?: string
          p_bio?: string
          p_display_name: string
          p_half_day?: number
          p_handle?: string
          p_languages?: string[]
          p_location?: string
          p_niche?: string
          p_source_url?: string
          p_sources?: Json
        }
        Returns: Json
      }
      crm_convert_deal: {
        Args: { p_deal_id: string; p_decision: string }
        Returns: {
          brand_id: string
          deal_id: string
          stage: string
        }[]
      }
      crm_deals_verify_convert_stage: {
        Args: { p_deal_id: string; p_stage: string }
        Returns: undefined
      }
      expire_stale_bookings: { Args: never; Returns: number }
      expire_stale_brand_analysis: { Args: never; Returns: number }
      get_booking: { Args: { p_booking_id: string }; Returns: Json }
      get_brand_assets: {
        Args: { p_brand_id: string; p_shoot_id?: string }
        Returns: Json
      }
      get_event_registration_count: {
        Args: { p_event_id: string }
        Returns: number
      }
      get_openable_shoots: {
        Args: { p_shoot_ids: string[] }
        Returns: {
          id: string
        }[]
      }
      get_or_create_shortlist: { Args: { p_org_id: string }; Returns: string }
      get_own_talent_profile: { Args: never; Returns: Json }
      get_shoot_detail: { Args: { p_shoot_id: string }; Returns: Json }
      get_user_shoots: {
        Args: {
          status_filter?: Database["public"]["Enums"]["shoot_status_v2"]
          user_id: string
        }
        Returns: {
          created_at: string
          estimated_quote: number
          fashion_category: string
          id: string
          scheduled_date: string
          scheduled_time: string
          shoot_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["shoot_status_v2"]
        }[]
      }
      handle_moderation_event: {
        Args: {
          p_cloudinary_asset_id: string
          p_moderation_kind: string
          p_moderation_status: string
          p_public_id: string
          p_request_id: string
          p_version: number
        }
        Returns: string
      }
      identify_rls_policies_needing_optimization: {
        Args: never
        Returns: {
          cmd: string
          definition: string
          policyname: string
          recommendation: string
          schemaname: string
          tablename: string
        }[]
      }
      is_org_editor_or_above: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { p_org_id: string }; Returns: boolean }
      is_organizer_team_member: {
        Args: { p_team_id: string }
        Returns: boolean
      }
      list_bookings: {
        Args: {
          p_cursor?: string
          p_limit?: number
          p_org_id?: string
          p_role: string
          p_status?: string[]
          p_talent_profile_id?: string
        }
        Returns: Json
      }
      list_notifications: {
        Args: { p_cursor?: string; p_limit?: number; p_unread_only?: boolean }
        Returns: Json
      }
      mark_notifications_read: {
        Args: { p_mark_all?: boolean; p_notification_ids?: string[] }
        Returns: Json
      }
      materialize_onboarding_session: {
        Args: {
          p_brand_name: string
          p_brand_url: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      notification_row_to_jsonb: {
        Args: { n: Database["public"]["Tables"]["notifications"]["Row"] }
        Returns: Json
      }
      notification_visible_to_caller: {
        Args: { n: Database["public"]["Tables"]["notifications"]["Row"] }
        Returns: boolean
      }
      planner_approve_gate: {
        Args: {
          p_changed_tasks: Json
          p_expected_dependency_edges: Json
          p_idempotency_key: string
          p_instance_id: string
          p_phase_id: string
          p_proposed_dependency_edges?: Json
        }
        Returns: Json
      }
      planner_create_instance: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_idempotency_key: string
          p_name: string
          p_org_id: string
          p_owner_user_id?: string
          p_planned_start: string
          p_tasks: Json
          p_workflow_id: string
        }
        Returns: Json
      }
      planner_discard_gate: {
        Args: {
          p_idempotency_key: string
          p_instance_id: string
          p_phase_id: string
          p_reason?: string
        }
        Returns: Json
      }
      planner_get_instance_detail: {
        Args: { p_instance_id: string }
        Returns: Json
      }
      planner_get_member_names: {
        Args: { p_instance_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      planner_get_my_assignment: {
        Args: { p_instance_id: string }
        Returns: {
          id: string
          instance_id: string
          permissions: Json
          role: string
          user_id: string
        }[]
      }
      planner_invite_member: {
        Args: { p_email: string; p_instance_id: string; p_role: string }
        Returns: {
          id: string
          instance_id: string
          role: string
          user_id: string
        }[]
      }
      planner_list_instances: {
        Args: {
          p_cursor?: string
          p_entity_type?: string
          p_include_archived?: boolean
          p_limit?: number
          p_org_id: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      planner_remove_assignment: {
        Args: { p_instance_id: string; p_target_user_id: string }
        Returns: {
          id: string
          instance_id: string
          role: string
          user_id: string
        }[]
      }
      planner_shift_task: {
        Args: {
          p_changed_tasks: Json
          p_delta_days: number
          p_expected_dependency_edges: Json
          p_idempotency_key: string
          p_instance_id: string
          p_root_task_id: string
        }
        Returns: Json
      }
      planner_update_role: {
        Args: {
          p_instance_id: string
          p_new_role: string
          p_target_user_id: string
        }
        Returns: {
          id: string
          instance_id: string
          role: string
          user_id: string
        }[]
      }
      planner_update_task: {
        Args: {
          p_expected_updated_at: string
          p_idempotency_key: string
          p_instance_id: string
          p_patch: Json
          p_task_id: string
        }
        Returns: Json
      }
      search_brands: {
        Args: {
          p_embedding: string
          p_exclude_brand_id?: string
          p_limit?: number
          p_org_id: string
        }
        Returns: {
          brand_id: string
          brand_name: string
          shared_nodes: Json
          similarity: number
        }[]
      }
      search_context_snapshots: {
        Args: {
          p_embedding: string
          p_limit?: number
          p_task_type?: string
          p_user_id: string
        }
        Returns: {
          agent_name: string
          content: Json
          created_at: string
          id: string
          session_id: string
          similarity: number
          snapshot_type: string
          summary: string
          task_type: string
          token_estimate: number
        }[]
      }
      search_talent: {
        Args: {
          p_budget_tier?: string
          p_date_end?: string
          p_date_start?: string
          p_only_shortlist_id?: string
          p_representation?: string
          p_shoot_type?: string
        }
        Returns: Json[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_shortlist_item: {
        Args: {
          p_add: boolean
          p_shortlist_id: string
          p_talent_profile_id: string
        }
        Returns: undefined
      }
      transition_booking: {
        Args: {
          p_booking_id: string
          p_cancellation_reason?: string
          p_date_end?: string
          p_date_start?: string
          p_expected_version: number
          p_rate_quoted?: number
          p_to_status?: string
        }
        Returns: Json
      }
      traverse_brand_graph: {
        Args: {
          p_edge_types?: string[]
          p_max_hops?: number
          p_start_node_id: string
        }
        Returns: {
          edge_types: string[]
          label: string
          node_id: string
          node_type: string
          path_length: number
        }[]
      }
      v2_shoot_owned_by_brand: {
        Args: { p_brand_id: string; p_shoot_id: string }
        Returns: boolean
      }
    }
    Enums: {
      asset_role:
        | "reference"
        | "raw"
        | "final"
        | "hero"
        | "gallery"
        | "thumbnail"
        | "promo"
        | "bts"
        | "moodboard"
      asset_type: "image" | "video" | "document"
      availability_status:
        | "available"
        | "reserved"
        | "booked"
        | "conflict"
        | "travel"
        | "maintenance"
        | "not_available"
      brand_crawl_job_status:
        | "queued"
        | "running"
        | "complete"
        | "failed"
        | "cancelled"
      brand_crawl_pipeline_state:
        | "crawl_only"
        | "pending_analysis"
        | "analysis_running"
        | "analysis_complete"
        | "scoring_running"
        | "scoring_complete"
        | "pipeline_failed"
      brand_intake_status:
        | "brand_created"
        | "crawl_running"
        | "crawl_complete"
        | "analysis_running"
        | "scores_complete"
        | "ready"
        | "failed"
        | "draft_ready"
      brand_type:
        | "couture"
        | "streetwear"
        | "bridal"
        | "swim"
        | "rtw"
        | "avant_garde"
        | "menswear"
      campaign_objective_type:
        | "brand_awareness"
        | "product_launch"
        | "conversion"
        | "retention"
        | "community"
        | "seo_discovery"
        | "ecommerce_direct"
      campaign_status: "planning" | "active" | "live" | "complete"
      deliverable_status:
        | "pending"
        | "in_progress"
        | "review"
        | "approved"
        | "blocked"
      distribution_channel:
        | "instagram_feed"
        | "instagram_reels"
        | "instagram_stories"
        | "tiktok"
        | "youtube"
        | "amazon_listing"
        | "shopify_pdp"
        | "facebook"
        | "pinterest"
        | "email_campaign"
        | "print"
      event_status:
        | "draft"
        | "review"
        | "published"
        | "sold_out"
        | "live"
        | "cancelled"
        | "completed"
      event_type:
        | "runway_show"
        | "presentation"
        | "pop_up"
        | "trunk_show"
        | "workshop"
        | "networking"
        | "party"
      fitting_status:
        | "pending"
        | "scheduled"
        | "completed"
        | "rescheduled"
        | "cancelled"
      funnel_stage_type:
        | "awareness"
        | "consideration"
        | "conversion"
        | "retention"
      indoor_outdoor: "indoor" | "outdoor" | "mixed"
      location_mode: "virtual" | "studio" | "hybrid"
      organizer_type:
        | "agency"
        | "production_house"
        | "freelance_collective"
        | "internal"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      phase_status:
        | "not_started"
        | "in_progress"
        | "blocked"
        | "completed"
        | "at_risk"
      registration_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "cancelled"
        | "refunded"
      registration_type: "general" | "vip" | "media" | "buyer" | "staff"
      rehearsal_type:
        | "full_run"
        | "lighting_test"
        | "sound_check"
        | "walk_practice"
        | "tech_run"
      retouching_level: "basic" | "high_end"
      schedule_type:
        | "rehearsal"
        | "fitting"
        | "hair_makeup"
        | "call_time"
        | "runway_show"
        | "sponsor_activation"
        | "vip_reception"
        | "teardown"
        | "photo_call"
      season_type: "ss" | "aw" | "resort" | "pre_fall" | "bridal" | "capsule"
      service_type: "photography" | "video" | "hybrid"
      shoot_service_type: "photo" | "video" | "hybrid"
      shoot_status:
        | "draft"
        | "ready_for_payment"
        | "confirmed"
        | "shooting"
        | "editing"
        | "delivered"
        | "cancelled"
      shoot_status_v2:
        | "draft"
        | "requested"
        | "confirmed"
        | "production"
        | "post_production"
        | "review"
        | "completed"
        | "cancelled"
      shot_style_type:
        | "packshot"
        | "flat_lay"
        | "on_model"
        | "lifestyle"
        | "detail"
        | "creative_splash"
        | "editorial"
        | "beauty"
      spec_confidence: "official" | "community" | "estimated"
      sponsor_level: "title" | "gold" | "silver" | "partner" | "in_kind"
      sponsor_tier: "title" | "gold" | "silver" | "bronze" | "partner"
      stakeholder_role:
        | "organizer"
        | "photographer"
        | "videographer"
        | "stylist"
        | "mua"
        | "backstage_manager"
        | "production_assistant"
        | "dj"
        | "lighting_director"
        | "other"
      stakeholder_role_enum:
        | "designer"
        | "producer"
        | "model"
        | "model_agency"
        | "hmu_lead"
        | "stylist"
        | "backstage_crew"
        | "venue_manager"
        | "lighting_sound"
        | "sponsor"
        | "pr_agent"
        | "photographer"
        | "videographer"
        | "volunteer"
        | "security"
        | "guest"
        | "other"
      talent_type: "hand" | "full_body" | "pet" | "none"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "todo"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
      ticket_tier_type: "free" | "paid" | "donation"
      user_role:
        | "designer"
        | "studio_admin"
        | "organizer"
        | "photographer"
        | "model"
        | "attendee"
        | "admin"
      venue_type:
        | "runway"
        | "gallery"
        | "hotel"
        | "warehouse"
        | "rooftop"
        | "outdoor"
        | "studio"
        | "other"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      asset_role: [
        "reference",
        "raw",
        "final",
        "hero",
        "gallery",
        "thumbnail",
        "promo",
        "bts",
        "moodboard",
      ],
      asset_type: ["image", "video", "document"],
      availability_status: [
        "available",
        "reserved",
        "booked",
        "conflict",
        "travel",
        "maintenance",
        "not_available",
      ],
      brand_crawl_job_status: [
        "queued",
        "running",
        "complete",
        "failed",
        "cancelled",
      ],
      brand_crawl_pipeline_state: [
        "crawl_only",
        "pending_analysis",
        "analysis_running",
        "analysis_complete",
        "scoring_running",
        "scoring_complete",
        "pipeline_failed",
      ],
      brand_intake_status: [
        "brand_created",
        "crawl_running",
        "crawl_complete",
        "analysis_running",
        "scores_complete",
        "ready",
        "failed",
        "draft_ready",
      ],
      brand_type: [
        "couture",
        "streetwear",
        "bridal",
        "swim",
        "rtw",
        "avant_garde",
        "menswear",
      ],
      campaign_objective_type: [
        "brand_awareness",
        "product_launch",
        "conversion",
        "retention",
        "community",
        "seo_discovery",
        "ecommerce_direct",
      ],
      campaign_status: ["planning", "active", "live", "complete"],
      deliverable_status: [
        "pending",
        "in_progress",
        "review",
        "approved",
        "blocked",
      ],
      distribution_channel: [
        "instagram_feed",
        "instagram_reels",
        "instagram_stories",
        "tiktok",
        "youtube",
        "amazon_listing",
        "shopify_pdp",
        "facebook",
        "pinterest",
        "email_campaign",
        "print",
      ],
      event_status: [
        "draft",
        "review",
        "published",
        "sold_out",
        "live",
        "cancelled",
        "completed",
      ],
      event_type: [
        "runway_show",
        "presentation",
        "pop_up",
        "trunk_show",
        "workshop",
        "networking",
        "party",
      ],
      fitting_status: [
        "pending",
        "scheduled",
        "completed",
        "rescheduled",
        "cancelled",
      ],
      funnel_stage_type: [
        "awareness",
        "consideration",
        "conversion",
        "retention",
      ],
      indoor_outdoor: ["indoor", "outdoor", "mixed"],
      location_mode: ["virtual", "studio", "hybrid"],
      organizer_type: [
        "agency",
        "production_house",
        "freelance_collective",
        "internal",
      ],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      phase_status: [
        "not_started",
        "in_progress",
        "blocked",
        "completed",
        "at_risk",
      ],
      registration_status: [
        "pending",
        "confirmed",
        "checked_in",
        "cancelled",
        "refunded",
      ],
      registration_type: ["general", "vip", "media", "buyer", "staff"],
      rehearsal_type: [
        "full_run",
        "lighting_test",
        "sound_check",
        "walk_practice",
        "tech_run",
      ],
      retouching_level: ["basic", "high_end"],
      schedule_type: [
        "rehearsal",
        "fitting",
        "hair_makeup",
        "call_time",
        "runway_show",
        "sponsor_activation",
        "vip_reception",
        "teardown",
        "photo_call",
      ],
      season_type: ["ss", "aw", "resort", "pre_fall", "bridal", "capsule"],
      service_type: ["photography", "video", "hybrid"],
      shoot_service_type: ["photo", "video", "hybrid"],
      shoot_status: [
        "draft",
        "ready_for_payment",
        "confirmed",
        "shooting",
        "editing",
        "delivered",
        "cancelled",
      ],
      shoot_status_v2: [
        "draft",
        "requested",
        "confirmed",
        "production",
        "post_production",
        "review",
        "completed",
        "cancelled",
      ],
      shot_style_type: [
        "packshot",
        "flat_lay",
        "on_model",
        "lifestyle",
        "detail",
        "creative_splash",
        "editorial",
        "beauty",
      ],
      spec_confidence: ["official", "community", "estimated"],
      sponsor_level: ["title", "gold", "silver", "partner", "in_kind"],
      sponsor_tier: ["title", "gold", "silver", "bronze", "partner"],
      stakeholder_role: [
        "organizer",
        "photographer",
        "videographer",
        "stylist",
        "mua",
        "backstage_manager",
        "production_assistant",
        "dj",
        "lighting_director",
        "other",
      ],
      stakeholder_role_enum: [
        "designer",
        "producer",
        "model",
        "model_agency",
        "hmu_lead",
        "stylist",
        "backstage_crew",
        "venue_manager",
        "lighting_sound",
        "sponsor",
        "pr_agent",
        "photographer",
        "videographer",
        "volunteer",
        "security",
        "guest",
        "other",
      ],
      talent_type: ["hand", "full_body", "pet", "none"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["todo", "in_progress", "blocked", "completed", "cancelled"],
      ticket_tier_type: ["free", "paid", "donation"],
      user_role: [
        "designer",
        "studio_admin",
        "organizer",
        "photographer",
        "model",
        "attendee",
        "admin",
      ],
      venue_type: [
        "runway",
        "gallery",
        "hotel",
        "warehouse",
        "rooftop",
        "outdoor",
        "studio",
        "other",
      ],
    },
  },
} as const
