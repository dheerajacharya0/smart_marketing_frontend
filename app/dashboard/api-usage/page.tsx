import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Download, Calendar } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function ApiUsagePage() {
  return (
    <div className="container mx-auto p-responsive">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">API Usage</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Calendar className="h-4 w-4 mr-2" />
            Last 30 Days
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total API Calls</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">5,234</div>
            <p className="text-xs text-muted-foreground mt-2">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground mt-2">+22% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Received</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">987</div>
            <p className="text-xs text-muted-foreground mt-2">+8% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">By Account</TabsTrigger>
          <TabsTrigger value="endpoints">By Endpoint</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Usage Trends</CardTitle>
              <CardDescription>API call volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted/20 rounded-md flex items-center justify-center">
                <p className="text-muted-foreground">API Usage Chart (Mock)</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage by Message Type</CardTitle>
                <CardDescription>Breakdown of message types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Text Messages</span>
                      <span>65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Template Messages</span>
                      <span>25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Media Messages</span>
                      <span>8%</span>
                    </div>
                    <Progress value={8} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Interactive Messages</span>
                      <span>2%</span>
                    </div>
                    <Progress value={2} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
                <CardDescription>API response performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Average Response Time</p>
                      <p className="text-2xl font-bold">245ms</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">99th Percentile</p>
                      <p className="text-2xl font-bold">890ms</p>
                    </div>
                  </div>
                  <div className="h-[150px] bg-muted/20 rounded-md flex items-center justify-center">
                    <p className="text-muted-foreground">Response Time Chart (Mock)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage by WhatsApp Business Account</CardTitle>
              <CardDescription>API usage breakdown by account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium">Acme Support</span>
                    </div>
                    <span>2,450 calls</span>
                  </div>
                  <Progress value={47} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>47% of total</span>
                    <span>Daily limit: 5,000</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium">Acme Marketing</span>
                    </div>
                    <span>1,780 calls</span>
                  </div>
                  <Progress value={34} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>34% of total</span>
                    <span>Daily limit: 5,000</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span className="font-medium">Acme Sales</span>
                    </div>
                    <span>1,004 calls</span>
                  </div>
                  <Progress value={19} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>19% of total</span>
                    <span>Daily limit: 5,000</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Usage Details</CardTitle>
              <CardDescription>Detailed breakdown by account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md divide-y">
                <div className="grid grid-cols-5 p-4 font-medium">
                  <div>Account</div>
                  <div>Messages Sent</div>
                  <div>Messages Received</div>
                  <div>API Calls</div>
                  <div>Error Rate</div>
                </div>
                <div className="grid grid-cols-5 p-4">
                  <div>Acme Support</div>
                  <div>845</div>
                  <div>623</div>
                  <div>2,450</div>
                  <div>0.8%</div>
                </div>
                <div className="grid grid-cols-5 p-4">
                  <div>Acme Marketing</div>
                  <div>389</div>
                  <div>245</div>
                  <div>1,780</div>
                  <div>1.2%</div>
                </div>
                <div className="grid grid-cols-5 p-4">
                  <div>Acme Sales</div>
                  <div>0</div>
                  <div>0</div>
                  <div>1,004</div>
                  <div>3.5%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage by API Endpoint</CardTitle>
              <CardDescription>API call distribution by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium">/messages</span>
                    </div>
                    <span>3,245 calls</span>
                  </div>
                  <Progress value={62} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>62% of total</span>
                    <span>Avg. response time: 210ms</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium">/templates</span>
                    </div>
                    <span>980 calls</span>
                  </div>
                  <Progress value={19} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>19% of total</span>
                    <span>Avg. response time: 180ms</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span className="font-medium">/media</span>
                    </div>
                    <span>650 calls</span>
                  </div>
                  <Progress value={12} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>12% of total</span>
                    <span>Avg. response time: 350ms</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="font-medium">Other endpoints</span>
                    </div>
                    <span>359 calls</span>
                  </div>
                  <Progress value={7} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>7% of total</span>
                    <span>Avg. response time: 290ms</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top API Errors</CardTitle>
              <CardDescription>Most common error responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md divide-y">
                <div className="grid grid-cols-4 p-4 font-medium">
                  <div>Error Code</div>
                  <div>Description</div>
                  <div>Count</div>
                  <div>% of Errors</div>
                </div>
                <div className="grid grid-cols-4 p-4">
                  <div>400</div>
                  <div>Bad Request - Invalid Parameters</div>
                  <div>45</div>
                  <div>38%</div>
                </div>
                <div className="grid grid-cols-4 p-4">
                  <div>429</div>
                  <div>Rate Limit Exceeded</div>
                  <div>32</div>
                  <div>27%</div>
                </div>
                <div className="grid grid-cols-4 p-4">
                  <div>401</div>
                  <div>Unauthorized - Invalid Token</div>
                  <div>24</div>
                  <div>20%</div>
                </div>
                <div className="grid grid-cols-4 p-4">
                  <div>500</div>
                  <div>Internal Server Error</div>
                  <div>18</div>
                  <div>15%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
