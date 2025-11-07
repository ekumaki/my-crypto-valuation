import * as functions from "firebase-functions";
import * as cors from "cors";

// CORSを有効化（すべてのオリジンを許可）
const corsHandler = cors({origin: true});

/**
 * CoinGecko API プロキシエンドポイント
 *
 * クライアント側のCORS制限を回避するため、サーバー側でCoinGecko APIを呼び出す
 *
 * クエリパラメータ:
 * - coinId: CoinGeckoのコインID (例: bitcoin, ethereum)
 * - date: DD-MM-YYYY形式の日付
 *
 * 使用例:
 * GET /getCoinPrice?coinId=bitcoin&date=05-11-2025
 */
export const getCoinPrice = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      // クエリパラメータを取得
      const coinId = request.query.coinId as string;
      const date = request.query.date as string;

      // パラメータのバリデーション
      if (!coinId || !date) {
        response.status(400).json({
          error: "Missing required parameters",
          message: "Both coinId and date are required",
        });
        return;
      }

      // 日付フォーマットの簡易チェック（DD-MM-YYYY）
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(date)) {
        response.status(400).json({
          error: "Invalid date format",
          message: "Date must be in DD-MM-YYYY format",
        });
        return;
      }

      // CoinGecko APIを呼び出し
      const apiUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${date}`;

      functions.logger.info(`Fetching price for ${coinId} on ${date}`);

      const apiResponse = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      // APIレスポンスのステータスチェック
      if (!apiResponse.ok) {
        functions.logger.error(`CoinGecko API error: ${apiResponse.status} ${apiResponse.statusText}`);

        if (apiResponse.status === 429) {
          response.status(429).json({
            error: "Rate limit exceeded",
            message: "CoinGecko API rate limit exceeded. Please try again later.",
          });
          return;
        }

        response.status(apiResponse.status).json({
          error: "CoinGecko API error",
          message: `Failed to fetch data from CoinGecko: ${apiResponse.statusText}`,
        });
        return;
      }

      // レスポンスデータを取得
      const data = await apiResponse.json();

      functions.logger.info(`Successfully fetched price for ${coinId}`);

      // クライアントにレスポンスを返す
      response.status(200).json(data);
    } catch (error) {
      // エラーハンドリング
      functions.logger.error("Proxy error:", error);

      response.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Failed to fetch price data",
      });
    }
  });
});
