//+------------------------------------------------------------------+
//|                                     Mcharts_V75_AutoTrader.mq5   |
//|                   Mcharts Deriv V75 Algo Auto-Trading Expert     |
//|               Synchronized with WebApp MSTT Breakout Engine      |
//+------------------------------------------------------------------+
#property copyright   "Mcharts Algo Trading Engine"
#property link        "https://mrvol75.vercel.app"
#property version     "2.00"
#property description "Auto-Trader EA connecting Deriv MT5 directly to Mcharts WebApp Cloud Signals."
#property description "Polls WebApp API (/api/ea-signal) every 2-5s and executes verified breakout trades with 0-lag."
#property description "Includes atomic order ACK & duplicate trade prevention."

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== 🌐 WebApp Cloud Connection ==="
input string   InpWebAppUrl             = "https://mrvol75.vercel.app"; // WebApp Base URL (No trailing slash)
input int      InpPollIntervalSeconds   = 3;                            // Polling Interval in Seconds (1 to 10s)

input group "=== ⚙️ Trade & Risk Execution ==="
input string   InpSymbolOverride        = "auto";                       // Symbol: 'auto', 'Volatility 75 Index', or 'R_75'
input double   InpLotSize               = 0.001;                        // Default Lot Size (V75 min: 0.001)
input ulong    InpMagicNumber           = 757575;                       // EA Magic Number
input ulong    InpSlippagePoints        = 50;                           // Max Deviation / Slippage
input bool     InpUseSignalLotSize      = true;                         // Use Lot Size sent by WebApp

input group "=== 🛡️ Safeguards & Notifications ==="
input int      InpMaxOpenTrades         = 1;                            // Max Simultaneous Open Positions
input bool     InpSendServerAck         = true;                         // Send Execution & Close ACK to WebApp

//+------------------------------------------------------------------+
//| GLOBAL VARIABLES                                                 |
//+------------------------------------------------------------------+
CTrade         m_trade;
string         g_activeSymbol          = "";
string         g_lastHandledSignalId   = "";
string         g_activeSignalId        = "";
ulong          g_activeTicket          = 0;
datetime       g_lastPollTime          = 0;
string         g_connectionStatus      = "Initializing...";
int            g_totalOrdersExecuted   = 0;
double         g_totalProfitToday      = 0.0;
bool           g_isPositionRunning     = false;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Set trade parameters
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippagePoints);
   m_trade.SetTypeFilling(ORDER_FILLING_FOK);

   // Determine active symbol
   if (InpSymbolOverride == "auto" || InpSymbolOverride == "")
   {
      if (SymbolSelect("Volatility 75 Index", true))
         g_activeSymbol = "Volatility 75 Index";
      else if (SymbolSelect("R_75", true))
         g_activeSymbol = "R_75";
      else if (SymbolSelect("Volatility 75 (1s) Index", true))
         g_activeSymbol = "Volatility 75 (1s) Index";
      else
         g_activeSymbol = _Symbol;
   }
   else
   {
      g_activeSymbol = InpSymbolOverride;
      SymbolSelect(g_activeSymbol, true);
   }

   PrintFormat("🤖 [Mcharts EA] Started on symbol: %s | WebApp: %s | Magic: %d", g_activeSymbol, InpWebAppUrl, InpMagicNumber);

   // Setup High-Speed Polling Timer
   int pollSec = MathMax(1, MathMin(60, InpPollIntervalSeconds));
   EventSetTimer(pollSec);

   UpdateChartHUD("🟢 CONNECTED - Waiting for first poll...");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
   Print("🛑 [Mcharts EA] Stopped.");
}

//+------------------------------------------------------------------+
//| Expert timer function (High-Speed Engine Loop)                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   g_lastPollTime = TimeCurrent();

   // Step 1: Monitor any active open position and detect closures
   MonitorActivePosition();

   // Step 2: Check if maximum open trades reached
   int openCount = CountOpenPositions();
   if (openCount >= InpMaxOpenTrades)
   {
      UpdateChartHUD(StringFormat("🟡 POSITION RUNNING (#%I64u) - Polling Idle", g_activeTicket));
      return;
   }

   // Step 3: Query WebApp for PENDING breakout signals
   string url = InpWebAppUrl + "/api/ea-signal";
   string response = "";
   int httpCode = SendHttpRequest("GET", url, "", response);

   if (httpCode != 200)
   {
      g_connectionStatus = StringFormat("🔴 HTTP ERROR %d", httpCode);
      UpdateChartHUD(StringFormat("🔴 HTTP Error (%d) - Check WebRequest URL in MT5 Options", httpCode));
      return;
   }

   g_connectionStatus = "🟢 ONLINE / SYNCHRONIZED";

   // Parse JSON Response Status
   string status = GetJsonStringValue(response, "status");

   if (status == "PAUSED")
   {
      UpdateChartHUD("⏸️ AUTO-BOT PAUSED BY USER in WebApp settings");
      return;
   }

   if (status == "CIRCUIT_BREAKER_ACTIVE")
   {
      long losses = GetJsonLongValue(response, "consecutiveLossesToday");
      UpdateChartHUD(StringFormat("🛑 CIRCUIT BREAKER ACTIVE - Max Daily Losses Reached (%d). Paused.", losses));
      return;
   }

   if (status == "IDLE")
   {
      UpdateChartHUD("🟢 MONITORING MARKET - Zero pending signals. Waiting for 30M BOS Breakout...");
      return;
   }

   if (status == "PENDING")
   {
      // Extract signal details
      string sigId    = GetJsonStringValue(response, "id");
      string sigType  = GetJsonStringValue(response, "type");
      double entryP   = GetJsonDoubleValue(response, "entryPrice");
      double slP      = GetJsonDoubleValue(response, "slPrice");
      double tp1P     = GetJsonDoubleValue(response, "tp1Price");
      double lotP     = GetJsonDoubleValue(response, "lotSize");

      if (sigId == "" || sigType == "")
      {
         UpdateChartHUD("⚠️ Received PENDING without ID/Type");
         return;
      }

      // Idempotency: Prevent duplicate execution of same signal ID
      if (sigId == g_lastHandledSignalId)
      {
         UpdateChartHUD(StringFormat("⚠️ Signal %s already executed! Waiting for ACK sync...", sigId));
         return;
      }

      // Execute Trade
      double tradeLot = (InpUseSignalLotSize && lotP > 0) ? lotP : InpLotSize;
      ExecuteSignalOrder(sigId, sigType, tradeLot, slP, tp1P);
   }
}

//+------------------------------------------------------------------+
//| Execute verified BUY/SELL Order and send ACK                     |
//+------------------------------------------------------------------+
void ExecuteSignalOrder(string sigId, string sigType, double lot, double slPrice, double tpPrice)
{
   PrintFormat("⚡ [Mcharts EA] Executing %s Signal: %s | Lot: %.3f | SL: %.2f | TP: %.2f", sigType, sigId, lot, slPrice, tpPrice);

   bool success = false;
   ulong orderTicket = 0;
   double execPrice = 0.0;

   // Align Filling mode
   uint filling = (uint)SymbolInfoInteger(g_activeSymbol, SYMBOL_FILLING_MODE);
   if ((filling & SYMBOL_FILLING_FOK) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if ((filling & SYMBOL_FILLING_IOC) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      m_trade.SetTypeFilling(ORDER_FILLING_RETURN);

   if (sigType == "BUY" || sigType == "bull")
   {
      success = m_trade.Buy(lot, g_activeSymbol, 0, slPrice, tpPrice, sigId);
   }
   else if (sigType == "SELL" || sigType == "bear")
   {
      success = m_trade.Sell(lot, g_activeSymbol, 0, slPrice, tpPrice, sigId);
   }

   if (success)
   {
      orderTicket = m_trade.ResultOrder();
      execPrice = m_trade.ResultPrice();
      if (orderTicket == 0) orderTicket = m_trade.ResultDeal();

      g_lastHandledSignalId = sigId;
      g_activeSignalId = sigId;
      g_activeTicket = orderTicket;
      g_isPositionRunning = true;
      g_totalOrdersExecuted++;

      PrintFormat("✅ [Mcharts EA] ORDER OPENED! Ticket: #%I64u at price: %.2f", orderTicket, execPrice);

      // Send Instant Acknowledgment to WebApp
      if (InpSendServerAck)
      {
         SendExecutionAck(sigId, orderTicket, execPrice);
      }

      UpdateChartHUD(StringFormat("🚀 ORDER EXECUTED! Ticket: #%I64u | Type: %s | SL: %.2f | TP: %.2f", orderTicket, sigType, slPrice, tpPrice));
   }
   else
   {
      PrintFormat("❌ [Mcharts EA] Order execution failed! Error code: %d | Retcode: %d", GetLastError(), m_trade.ResultRetcode());
      UpdateChartHUD(StringFormat("❌ Order Failed! Code: %d | Msg: %s", m_trade.ResultRetcode(), m_trade.ResultRetcodeDescription()));
   }
}

//+------------------------------------------------------------------+
//| Send Acknowledgment (ACK) to WebApp                              |
//+------------------------------------------------------------------+
void SendExecutionAck(string sigId, ulong ticket, double execPrice)
{
   string url = InpWebAppUrl + "/api/ea-ack";
   string payload = StringFormat(
      "{\"action\":\"EXECUTED\",\"signalId\":\"%s\",\"ticket\":%I64u,\"executionPrice\":%.2f}",
      sigId, ticket, execPrice
   );

   string resp = "";
   SendHttpRequest("POST", url, payload, resp);
   PrintFormat("📡 [Mcharts EA] Sent Execution ACK to server. Response: %s", resp);
}

//+------------------------------------------------------------------+
//| Monitor Active Position Closure & Report Outcome                 |
//+------------------------------------------------------------------+
void MonitorActivePosition()
{
   if (!g_isPositionRunning || g_activeTicket == 0) return;

   // Check if position still exists
   bool stillOpen = false;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket == g_activeTicket || PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         stillOpen = true;
         break;
      }
   }

   if (!stillOpen)
   {
      // Position closed! Check history for profit/loss
      g_isPositionRunning = false;
      double dealProfit = 0.0;
      double closePrice = 0.0;
      bool foundHistory = false;

      HistorySelect(TimeCurrent() - 86400, TimeCurrent() + 60);
      int deals = HistoryDealsTotal();
      for (int d = deals - 1; d >= 0; d--)
      {
         ulong dTicket = HistoryDealGetTicket(d);
         if (HistoryDealGetInteger(dTicket, DEAL_POSITION_ID) == g_activeTicket || HistoryDealGetInteger(dTicket, DEAL_ORDER) == g_activeTicket)
         {
            dealProfit = HistoryDealGetDouble(dTicket, DEAL_PROFIT);
            closePrice = HistoryDealGetDouble(dTicket, DEAL_PRICE);
            foundHistory = true;
            break;
         }
      }

      g_totalProfitToday += dealProfit;
      bool isWin = dealProfit > 0;

      PrintFormat("🏁 [Mcharts EA] Position #%I64u closed! Profit: $%.2f | Win: %s", g_activeTicket, dealProfit, isWin ? "YES" : "NO");

      // Send Trade Closed ACK to WebApp
      if (InpSendServerAck)
      {
         string url = InpWebAppUrl + "/api/ea-ack";
         string payload = StringFormat(
            "{\"action\":\"CLOSED\",\"signalId\":\"%s\",\"ticket\":%I64u,\"exitPrice\":%.2f,\"profit\":%.2f,\"isWin\":%s}",
            g_activeSignalId, g_activeTicket, closePrice, dealProfit, isWin ? "true" : "false"
         );
         string resp = "";
         SendHttpRequest("POST", url, payload, resp);
      }

      g_activeTicket = 0;
      g_activeSignalId = "";
   }
}

//+------------------------------------------------------------------+
//| Count Open Positions matching Magic Number                       |
//+------------------------------------------------------------------+
int CountOpenPositions()
{
   int count = 0;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if (PositionGetSymbol(i) == g_activeSymbol)
      {
         if (PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         {
            count++;
         }
      }
   }
   return count;
}

//+------------------------------------------------------------------+
//| Send HTTP Request via MT5 WebRequest                             |
//+------------------------------------------------------------------+
int SendHttpRequest(string method, string url, string postData, string &resultStr)
{
   char postDataArr[];
   char resultArr[];
   string headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
   string resultHeaders = "";

   if (method == "POST")
   {
      StringToCharArray(postData, postDataArr, 0, WHOLE_ARRAY, CP_UTF8);
      // Remove trailing null byte
      int len = ArraySize(postDataArr);
      if (len > 0 && postDataArr[len - 1] == 0)
         ArrayResize(postDataArr, len - 1);
   }

   ResetLastError();
   int res = WebRequest(method, url, headers, 3000, postDataArr, resultArr, resultHeaders);

   if (res == -1)
   {
      int err = GetLastError();
      if (err == 4014)
      {
         PrintFormat("⚠️ [Mcharts EA] WebRequest permission missing! Please add '%s' in MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest.", InpWebAppUrl);
      }
      return -1;
   }

   resultStr = CharArrayToString(resultArr, 0, WHOLE_ARRAY, CP_UTF8);
   return res;
}

//+------------------------------------------------------------------+
//| Lightweight JSON Parsers (Pure MQL5, Zero DLL Dependencies)      |
//+------------------------------------------------------------------+
string GetJsonStringValue(string json, string key)
{
   string search = "\"" + key + "\":\"";
   int pos = StringFind(json, search);
   if (pos >= 0)
   {
      int start = pos + StringLen(search);
      int end = StringFind(json, "\"", start);
      if (end > start)
         return StringSubstr(json, start, end - start);
   }

   // Also try unquoted value in case of numbers/booleans
   search = "\"" + key + "\":";
   pos = StringFind(json, search);
   if (pos >= 0)
   {
      int start = pos + StringLen(search);
      while (start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\"'))
         start++;

      int end = start;
      while (end < StringLen(json) &&
             StringGetCharacter(json, end) != ',' &&
             StringGetCharacter(json, end) != '}' &&
             StringGetCharacter(json, end) != '\"' &&
             StringGetCharacter(json, end) != '\r' &&
             StringGetCharacter(json, end) != '\n')
      {
         end++;
      }
      return StringSubstr(json, start, end - start);
   }

   return "";
}

double GetJsonDoubleValue(string json, string key)
{
   string val = GetJsonStringValue(json, key);
   return (val != "") ? StringToDouble(val) : 0.0;
}

long GetJsonLongValue(string json, string key)
{
   string val = GetJsonStringValue(json, key);
   return (val != "") ? StringToInteger(val) : 0;
}

//+------------------------------------------------------------------+
//| On-Chart HUD Display                                             |
//+------------------------------------------------------------------+
void UpdateChartHUD(string statusDetail)
{
   string hud = "";
   hud += "========================================================\n";
   hud += "   🤖 MCHARTS DERIV V75 AUTO-TRADING EXPERT (EA V2.0)   \n";
   hud += "========================================================\n";
   hud += StringFormat("📡 Server Connection : %s\n", g_connectionStatus);
   hud += StringFormat("🌐 WebApp URL         : %s\n", InpWebAppUrl);
   hud += StringFormat("🪙 Target Symbol      : %s\n", g_activeSymbol);
   hud += StringFormat("⚖️ Lot Size / Magic   : %.3f | #%I64u\n", InpLotSize, InpMagicNumber);
   hud += StringFormat("⏰ Last Poll Time     : %s\n", TimeToString(g_lastPollTime, TIME_DATE|TIME_SECONDS));
   hud += "--------------------------------------------------------\n";
   hud += StringFormat("📊 Status Detail      : %s\n", statusDetail);
   hud += StringFormat("🎫 Active Ticket      : %s\n", g_activeTicket > 0 ? ("#" + IntegerToString(g_activeTicket)) : "None (Waiting for signal)");
   hud += StringFormat("🏆 Total Executions   : %d Trades Today\n", g_totalOrdersExecuted);
   hud += "========================================================\n";
   hud += "💡 Tip: Keep MT5 running on VPS with 'AutoTrading' enabled.\n";

   Comment(hud);
}
